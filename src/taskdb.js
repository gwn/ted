const fs = require('fs')
const path = require('path')
const {pick, uniq, flatten, serialize, deserialize} = require('./util')


const dbDirSkeleton = [
    {path: '.', dir: true},
    {path: './counter', initial: '0'},
    {path: './index', initial: '{}'},
    {path: './archive', dir: true},
    {path: './archive/index', initial: '{}'},
]


const makeTaskDB = dbroot => {
    if (fs.existsSync(dbroot) && !checkIfDbDir(dbroot))
        return false

    generateSkeleton(dbroot)

    return {
        create: create.bind(null, dbroot),
        read: read.bind(null, dbroot),
        list: list.bind(null, dbroot),
        listTags: listTags.bind(null, dbroot),
        update: update.bind(null, dbroot),
        delete: delete_.bind(null, dbroot),
        exists: exists.bind(null, dbroot),
        archive: archive.bind(null, dbroot),
        unarchive: unarchive.bind(null, dbroot),
        reindex: reindex.bind(null, dbroot),
    }
}

const checkIfDbDir = dbroot =>
    dbDirSkeleton.every(file => fs.existsSync(path.join(dbroot, file.path)))

const generateSkeleton = dbroot => {
    dbDirSkeleton.forEach(file => {
        const fullPath = path.join(dbroot, file.path)

        if (!fs.existsSync(fullPath))
            if (file.dir)
                fs.mkdirSync(fullPath)
            else
                fs.writeFileSync(fullPath, file.initial)
    })
}

const create = (dbroot, recordOrText, opts = {}) => {
    const nextId = getNextId(dbroot)

    update(dbroot, nextId, recordOrText, opts)

    return nextId
}

const read = (dbroot, id, opts = {}) => {
    const {archive = false, raw = false} = opts

    const taskRoot = archive ? path.join(dbroot, 'archive') : dbroot
    const taskFileName = path.join(taskRoot, String(id))
    const taskContent = fs.readFileSync(taskFileName).toString()

    return raw ?
        taskContent:
        Object.assign({id}, parseTask(taskContent))
}

const list = (dbroot, opts = {}) => {
    const {
        archive = false,
        filter = {},
        order = {},
        limit = Infinity,
    } = opts

    const index = getIndex(dbroot, { archive })

    return (
        Object.entries(index)
            .filter(([id, task]) => filterTask(filter, task))
            .sort(sortTaskEntries.bind(null, order))
            .slice(0, limit)
            .map(([id, task]) => Object.assign({id}, task))
    )
}

const filterTask = (filter, task) => {
    switch (filter.type) {
    case 'all':
        return filter.params.every(tag => task.tags.includes(tag))

    case 'any':
        return filter.params.some(tag => task.tags.includes(tag))

    case 'match':
        return (new RegExp(filter.params[0], 'iu')).test(task.title)

    default:
        return true
    }
}

const sortTaskEntries = (order, [id1, task1], [id2, task2]) => {
    const numericFields = ['id', 'pri']
    let i, len, task1Val, task2Val, modifierFn

    for (i = 0, len = order.length; i < len; ++i) {
        task1Val = order[i].colName === 'id' ? id1 : task1[order[i].colName]
        task2Val = order[i].colName === 'id' ? id2 : task2[order[i].colName]

        if (numericFields.includes(order[i].colName)) {
            task1Val = Number(task1Val)
            task2Val = Number(task2Val)
        }

        if (task1Val === task2Val)
            continue

        modifierFn = order[i].direction === 'asc' ? x => x : x => !x

        return modifierFn(task1Val < task2Val) ? -1 : 1
    }

    return 0
}

const listTags = dbroot => uniq(flatten(list(dbroot).map(t => t.tags)))

const update = (dbroot, id, patchOrText, opts = {}) => {
    const {archive = false, raw = false} = opts

    const taskRoot = archive ? path.join(dbroot, 'archive') : dbroot
    const fileName = path.join(taskRoot, String(id))

    const patch = raw ? parseTask(patchOrText) : patchOrText

    const task =
        exists(dbroot, id, {archive}) ?
            read(dbroot, id, {archive}) :
            {}

    const patchedTask = applyPatch(patch, task)

    setIndex(dbroot, id, patchedTask, {archive})

    fs.writeFileSync(fileName, buildTask(patchedTask))
}

const delete_ = (dbroot, id, opts = {}) => {
    const {archive = false} = opts

    const taskRoot = archive ? path.join(dbroot, 'archive') : dbroot
    const fileName = path.join(taskRoot, String(id))

    delIndex(dbroot, id, {archive})

    fs.unlinkSync(fileName)
}

const exists = (dbroot, id, opts = {}) => {
    const {archive = false} = opts

    return id in getIndex(dbroot, {archive})
}

const archive = (dbroot, id) => toggleArchive(dbroot, id, true)

const unarchive = (dbroot, id) => toggleArchive(dbroot, id, false)

const toggleArchive = (dbroot, id, archive) => {
    if (!exists(dbroot, id, {archive: !archive}))
        return false

    const task = read(dbroot, id, {archive: !archive})

    delete_(dbroot, id, {archive: !archive})
    update(dbroot, id, task, {archive})
}

const makeIndexRecord = task => pick(['title', 'pri', 'tags'], task)

const getIndex = (dbroot, opts) => {
    const { archive = false } = opts
    const root = archive ? path.join(dbroot, 'archive') : dbroot
    const indexFile = path.join(root, 'index')

    return deserialize(fs.readFileSync(indexFile))
}

const setIndex = (dbroot, id, task, opts) => {
    const {archive = false, del = false} = opts
    const root = archive ? path.join(dbroot, 'archive') : dbroot
    const indexFile = path.join(root, 'index')

    const index = deserialize(fs.readFileSync(indexFile))

    if (!del)
        index[id] = makeIndexRecord(task)
    else
        delete index[id]

    fs.writeFileSync(indexFile, serialize(index, null, ' '))
}

const delIndex = (dbroot, id, opts) =>
    setIndex(dbroot, id, null, Object.assign({del: true}, opts))

const reindex = dbroot =>
    [dbroot, path.join(dbroot, 'archive')]
        .forEach(root => {
            const indexFile = path.join(root, 'index')

            const newIndex =
                fs.readdirSync(root)
                    .filter(fName =>
                        !['index', 'counter', 'archive'].includes(fName) &&
                        fName[0] !== '.'
                    )
                    .map(fName => ({
                        id: fName,
                        task: parseTask(
                            fs.readFileSync(path.join(root, fName)).toString()
                        ),
                    }))
                    .reduce((index, { id, task }) => Object.assign(index, {
                        [id]: makeIndexRecord(task),
                    }), {})

            fs.writeFileSync(indexFile, serialize(newIndex, null, ' '))
        })

const applyPatch = (patch, task) => ({
    title: patch.title || task.title,

    pri: patch.pri || task.pri,

    tags:
        (task.tags || []).concat(patch.tags || [])
            .filter((elem, idx, arr) => idx == arr.indexOf(elem)) // deduplicate
            .filter(t => !(patch.detags || []).includes(t)),

    description: patch.description || task.description,
})

const parseTask = taskContent => {
    const [
        title,
        priAndTags,
        ...descriptionParagraphs
    ]
        = taskContent.split('\n\n')

    const [pri, ...tags] = priAndTags.split(' ')

    const description = descriptionParagraphs.join('\n\n')

    return {title, pri, tags, description}
}

const buildTask = taskAttrs => {
    const {title, pri, tags, description} = taskAttrs

    return (
        title +
        '\n\n' +
        [pri, ...tags].join(' ') +
        '\n\n' +
        description
    )
}

const getNextId = dbroot => {
    const counterFile = path.join(dbroot, 'counter')
    const nextId = Number(fs.readFileSync(counterFile).toString()) + 1

    fs.writeFileSync(counterFile, String(nextId))

    return nextId
}


module.exports = makeTaskDB
