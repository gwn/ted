const path = require('path')
const os = require('os')
const fs = require('fs')
const { spawnSync } = require('child_process')


const log = console.log.bind(console)

const err = console.error.bind(console)

const isNumeric = numStr => {
    const casted = Number(numStr)
    const parsed = parseFloat(numStr)

    return casted === parsed && !isNaN(casted)
}

const pick = (keys, obj) =>
    Object.entries(obj)
        .filter(([key, val]) => keys.includes(key))
        .reduce((newObj, [key, val]) => (newObj[key] = val, newObj), {})

const flatten = arr => arr.reduce((acc, a) => acc.concat(a))
// shallow

const uniq = arr => ([...new Set(arr)])

// Wrapper for UNIX command `column`
const column = collection => {
    const input =
        collection
            .map(rec => Object.values(rec).join('\t'))
            .join('\n')

    const response =
        spawnSync('column', ['-t', '-s', '"\t"'], { input })

    return response.stdout.toString()
}

const editorPrompt = initial => {
    const tmpFile = path.join(os.homedir(), '.liltodo_tmp')
    const editor = process.env.EDITOR

    if (initial)
        fs.writeFileSync(tmpFile, initial)

    const { status } = spawnSync(editor, [tmpFile], { stdio: 'inherit' })

    if (status !== 0)
        return false

    const content = fs.readFileSync(tmpFile).toString()

    fs.unlinkSync(tmpFile)

    return content
}

const serialize = taskMap => [
    '{\n',
    Object.entries(taskMap)
        .map(([taskNo, taskContent]) =>
            '"' + taskNo + '":' + JSON.stringify(taskContent)
        )
        .join(',\n'),
    '\n}\n',
]
    .join('')

const deserialize = JSON.parse

module.exports = {
    log,
    err,
    isNumeric,
    pick,
    flatten,
    uniq,
    column,
    editorPrompt,
    serialize,
    deserialize,
}
