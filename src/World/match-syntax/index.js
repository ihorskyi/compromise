const parseToken = require('./01-parseToken')
const postProcess = require('./02-postProcess')
const hasReg = /[^[a-z]]\//g

const isArray = function (arr) {
  return Object.prototype.toString.call(arr) === '[object Array]'
}

// don't split up a regular expression
const mergeRegexes = function (arr) {
  arr.forEach((s, i) => {
    let m = s.match(hasReg)
    // has 1 slash
    if (m !== null && m.length === 1 && arr[i + 1]) {
      // merge next one
      arr[i] += arr[i + 1]
      arr[i + 1] = ''
      // try 2nd one
      m = arr[i].match(hasReg)
      if (m !== null && m.length === 1) {
        arr[i] += arr[i + 2]
        arr[i + 2] = ''
      }
    }
  })
  arr = arr.filter(s => s)
  return arr
}

//split-up by (these things)
const byParentheses = function (str) {
  let arr = str.split(/([\^\[\!]*(?:<\S+>)?\(.*?\)[?+*]*\]?\$?)/)
  arr = arr.map(s => s.trim())
  if (hasReg.test(str)) {
    arr = mergeRegexes(arr)
  }
  return arr
}

const byWords = function (arr) {
  let words = []
  arr.forEach(a => {
    //keep brackets lumped together
    if (/\(.*\)/.test(a)) {
      words.push(a)
      return
    }
    let list = a.split(' ')
    list = list.filter(w => w)
    words = words.concat(list)
  })
  return words
}

//turn an array into a 'choices' list
const byArray = function (arr) {
  let blocks = arr.map(s => {
    return [
      {
        word: s,
      },
    ]
  })
  return [
    {
      choices: blocks,
      operator: 'or',
    },
  ]
}

// turn a Doc object into a reg of ids to lookup
const fromDoc = function (doc) {
  if (!doc || !doc.list || !doc.list[0]) {
    return []
  }
  let regs = []
  doc.list.forEach(p => {
    let ids = []
    p.terms().forEach(t => {
      ids.push(t.id)
    })
    regs.push(ids)
  })
  return [{ idBlocks: regs }]
}

// add fuzziness etc to each reg
const addOptions = function (tokens, opts) {
  // add default fuzzy-search limit
  if (opts.fuzzy === true) {
    opts.fuzzy = 0.85
  }
  if (typeof opts.fuzzy === 'number') {
    tokens = tokens.map(reg => {
      // add a fuzzy-match on 'word' tokens
      if (opts.fuzzy > 0 && reg.word) {
        reg.fuzzy = opts.fuzzy
      }
      //add it to or|and choices too
      if (reg.choices) {
        reg.choices.forEach(block => {
          block.forEach(r => {
            r.fuzzy = opts.fuzzy
          })
        })
      }
      return reg
    })
  }
  return tokens
}

/** parse a match-syntax string into json */
const syntax = function (input, opts = {}) {
  // fail-fast
  if (input === null || input === undefined || input === '') {
    return []
  }
  //try to support a ton of different formats:
  if (typeof input === 'object') {
    if (isArray(input)) {
      if (input.length === 0 || !input[0]) {
        return []
      }

      //is it a pre-parsed reg-list?
      if (typeof input[0] === 'object') {
        return input
      }
      //support a flat array of normalized words
      if (typeof input[0] === 'string') {
        return byArray(input)
      }
    }
    //support passing-in a compromise object as a match
    if (input && input.isA === 'Doc') {
      return fromDoc(input)
    }
    return []
  }
  if (typeof input === 'number') {
    input = String(input) //go for it?
  }
  let tokens = byParentheses(input)
  // console.log(tokens)
  tokens = byWords(tokens)
  tokens = tokens.map(str => parseToken(str, opts))
  //clean up anything weird
  tokens = postProcess(tokens, opts)
  // add fuzzy limits, etc
  tokens = addOptions(tokens, opts)
  // console.log(tokens)
  return tokens
}

module.exports = syntax
// console.log(syntax('before [(united states|canadian)] after'))
