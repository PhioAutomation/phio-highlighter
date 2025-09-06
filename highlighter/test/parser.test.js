import { describe, it } from "vitest"
import { fileTests } from "@lezer/generator/test"
import { readdirSync, readFileSync } from "fs"
import { join } from "path"

// Import the parser
import { parser } from "../src/iecst-parser"

function parseTests(dir) {
  for (let file of readdirSync(dir)) {
    if (!file.endsWith(".st")) continue
    let tests = fileTests(readFileSync(join(dir, file), "utf8"), file)
    describe(file, () => {
      for (let { name, run } of tests) {
        it(name, () => run(parser))
      }
    })
  }
}

parseTests(join(__dirname, ".")) // runs all .txt tests in /test