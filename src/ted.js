#! /usr/bin/env node

const readline = require('readline')
const {log, err, isNumeric, columnarize, editorPrompt} = require('./util')
const makeTaskDB = require('./taskdb')

const PROMPTSTR = '> '

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
})

const defaultListOpts = {
    filter: {
        type: null,
        params: [],
    },
    order: [
        {
            direction: 'desc',
            colName: 'pri',
        },
    ],
    limit: 10,
    rawFilter: '',
    rawOrder: '-pri',
}


const makeCtx = dbroot => ({
    taskdb: makeTaskDB(dbroot),
    archive: false,
    filter: defaultListOpts.filter,
    order: defaultListOpts.order,
    limit: defaultListOpts.limit,
    rawFilter: defaultListOpts.rawFilter,
    rawOrder: defaultListOpts.rawOrder,
})

const main = () => {
    const dbpath = process.argv[2]

    if (!dbpath) {
        err('You must specify a todo directory!')
        return process.exit(1)
    }

    const ctx = makeCtx(dbpath)

    if (!ctx.taskdb) {
        err(
            'Argument must either be an existing task directory, ' +
            'or an empty directory!'
        )
        return process.exit(2)
    }

    prompt(ctx)
}

const prompt = ctx => {
    const {archive} = ctx
    const promptStr = '\n' + (archive ? 'a' : '') + PROMPTSTR

    rl.question(promptStr, cmd => {
        const result = handleCmd(ctx, cmd)

        if (result instanceof Promise)
            result.then(() => prompt(ctx))
        else
            prompt(ctx)
    })
}

const handleCmd = (ctx, rawCmd) => {
    const {actionName, args} = parseCmd(rawCmd)

    const actionMap = {
        list, view, t, f, F, o, O, l, L, c, e, p, a, A, d, h, q, reindex,
    }

    const action = actionMap[actionName]

    return action ? action(ctx, ...args) : h()
}

const parseCmd = rawCmd => {
    const [actionName, ...args] = rawCmd.split(' ')

    if (actionName === '')
        return {actionName: 'list', args: []}

    if (isNumeric(actionName))
        return {actionName: 'view', args: [actionName]}

    // `list` and `view` are exceptions as their command names
    // does not correspond to their function names.

    return {actionName, args}
}

const list = ctx => {
    const {taskdb, filter, order, limit, archive} = ctx
    const tasks =
        taskdb.list({filter, order, limit, archive})
            .map(task => [
                task.id,
                task.title,
                task.pri,
                task.tags.join(' '),
            ])

    const columnarized = columnarize(tasks)

    const stringified =
        columnarized
            .map(task => task.join('  '))
            .join('\n')

    log(stringified)
}

const view = (ctx, id) => {
    const {taskdb, archive} = ctx

    if (!taskdb.exists(id, {archive}))
        log('No such task!')

    log(taskdb.read(id, {raw: true, archive}))
}

const f = (ctx, filterSymbol, ...params) => {
    if (!filterSymbol)
        return log(ctx.rawFilter)

    if (['&', '|', '/'].includes(filterSymbol)) {
        ctx.rawFilter = [filterSymbol, ...params].join(' ')
        ctx.filter = parseFilter(ctx.rawFilter)
    } else
        err('Bad filter!')
}

const parseFilter = rawFilter => {
    const [filterSymbol, ...params] = rawFilter.split(' ')

    const filterSymbolsToNames = {
        '&': 'all',
        '|': 'any',
        '/': 'match',
    }

    return {
        type: filterSymbolsToNames[filterSymbol],
        params,
    }
}

const F = ctx => {
    ctx.filter = defaultListOpts.filter
    ctx.rawFilter = defaultListOpts.rawFilter
}

const o = (ctx, ...orderExprs) => {
    if (!orderExprs.length)
        return log(ctx.rawOrder)

    ctx.rawOrder = orderExprs.join(' ')
    ctx.order = parseOrder(ctx.rawOrder)
}

const parseOrder = rawOrder =>
    rawOrder.split(' ').map(expr =>
        expr[0] === '-' ?
            { direction: 'desc', colName: expr.slice(1) } :
            { direction: 'asc', colName: expr }
    )

const O = ctx => {
    ctx.order = defaultListOpts.order
    ctx.rawOrder = defaultListOpts.rawOrder
}

const l = (ctx, limit) => {
    if (!limit)
        return log(ctx.limit)

    if (isNumeric(limit))
        ctx.limit = limit
    else
        err('Bad limit!')
}

const L = ctx => (ctx.limit = defaultListOpts.limit)

const c = (ctx, ...words) => {
    const {taskdb, archive} = ctx
    const title = words.join(' ')
    let taskId

    if (title)
        taskId = taskdb.create({
            title,
            pri: 5,
            description: 'No description',
        }, {
            archive,
        })
    else
        taskId = taskdb.create(
            editorPrompt('No title\n\n5\n\nNo description'),
            {raw: true, archive}
        )

    log(taskId)
}

const e = (ctx, id) => {
    const {taskdb, archive} = ctx

    if (!taskdb.exists(id, {archive}))
        return log('No such task!')

    taskdb.update(
        id,
        editorPrompt(taskdb.read(id, {raw: true})),
        {raw: true, archive}
    )
}

const t = (ctx, id, ...tagExprs) => {
    const {taskdb, archive} = ctx

    if (!id)
        return log(taskdb.listTags().join('\n'))

    const isDetag = str => str[0] === '-'
    const tags = tagExprs.filter(e => !isDetag(e))
    const detags = tagExprs.filter(isDetag).map(t => t.slice(1))

    if (!taskdb.exists(id, {archive}))
        return log('No such task!')

    taskdb.update(id, {tags, detags}, {archive})
}

const p = (ctx, id, newPri) => {
    const {taskdb, archive} = ctx

    if (!taskdb.exists(id, {archive}))
        return log('No such task!')

    taskdb.update(id, {pri: newPri}, {archive})
}

const a = (ctx, id) =>
    id
        ? ctx.taskdb.archive(id)
        : toggleArchive(ctx, true)

const A = (ctx, id) =>
    id
        ? ctx.taskdb.unarchive(id)
        : toggleArchive(ctx, false)

const toggleArchive = (ctx, archive = null) =>
    ctx.archive = archive === null ? !ctx.archive : archive

const d = (ctx, id) => {
    const {taskdb, archive} = ctx

    if (!taskdb.exists(id, {archive}))
        return log('No such task!')

    const task = taskdb.read(id, {archive})

    return new Promise(resolve =>
        rl.question(`Delete "${task.title}"?\ny/n? `, answer =>
            (answer === 'y' && taskdb.delete(id, {archive}), resolve())))
}

/* eslint-disable max-len */
const h = () => log(`
    <empty>               List tasks that match the current filter
    <id>                  Show task #<id>
    f                     Show current filter
    f & <t1> [<t2> ..]    Set filter for all matching tags
    f | <t1> [<t2> ..]    Set filter for any matching tag
    f / <regex>           Set filter for given regex
    F                     Reset filter
    o                     Show current order
    o <col1> [<col2> ..]  Set column(s) to order the list by. Prefix column names with "-" for descending order
    O                     Reset order
    l                     Show current limit
    l <lim>               Set limit
    L                     Reset limit
    c                     Create new task with system editor
    c <title>             Create new task immediately with the given title
    e <id>                Edit task with system editor
    t                     Show tag list
    t <id> <t1> [<t2> ..] Add/remove tags to/from task. Prefix a tag with "-" to remove it.
    p <id> <pri>          Set task priority
    d <id>                Delete task completely
    a <id>                Archive task
    A <id>                Unarchive task
    a                     Start working on archived tasks
    A                     Stop working on archived tasks
    h                     Help
    q                     Quit
    reindex               Update the internal index. Call after manual updates
`)
/* eslint-enable max-len */

const q = () => process.exit(0)

const reindex = ctx => ctx.taskdb.reindex()


main()
