import { cmll_algs_raw, lookup_algset } from "./Algs";
import { cmll_algs_justin, cmll_case_names, cmllCaseName, cmllRevealText, findPreAuf, normalizeAlg } from "./CmllReveal";
import { CubieCube, MoveSeq } from "./CubeLib";

const AUFS = ["", "U", "U'", "U2"]
const cases = cmll_algs_raw.filter(([id]) => id !== "solved")

const solvesCorners = (caseAlg: string, alg: string) => {
    const cube = new CubieCube().apply(new MoveSeq(caseAlg).inv()).apply(new MoveSeq(alg))
    return AUFS.some(post => {
        const c = cube.apply(new MoveSeq(post))
        return c.cp.every((x, i) => x === i) && c.co.every(x => x === 0)
    })
}

it('has a personal alg for every CMLL case and nothing else', () => {
    expect(Object.keys(cmll_algs_justin).sort()).toEqual(cases.map(([id]) => id).sort())
})

it('each personal alg solves its case from some AUF', () => {
    for (const [id, defaultAlg] of cases) {
        for (const alg of cmll_algs_justin[id]) {
            expect([id, findPreAuf(defaultAlg, normalizeAlg(alg))]).not.toEqual([id, undefined])
        }
    }
})

it('revealed text solves the displayed case for every pre-AUF', () => {
    for (const [id, defaultAlg] of cases) {
        for (const auf of AUFS) {
            const caseAlg = new MoveSeq(auf + " " + defaultAlg).collapse().toString()
            const lines = cmllRevealText(id, caseAlg).split("\n")
            expect(lines.length).toBe(cmll_algs_justin[id].length)
            for (const line of lines) {
                // "(U') R U R'" -> "U' R U R'"
                expect([id, auf, line, solvesCorners(caseAlg, line.replace(/[()]/g, ""))])
                    .toEqual([id, auf, line, true])
            }
        }
    }
})

it('works for NMCLL case ids', () => {
    for (const desc of lookup_algset("nmcll")) {
        const text = cmllRevealText(desc.id, desc.algs[0])
        expect(text).not.toMatch(/doesn't solve/)
        for (const line of text.split("\n")) {
            expect(solvesCorners(desc.algs[0], line.replace(/[()]/g, ""))).toBe(true)
        }
    }
})

it('falls back to the default alg for unknown cases', () => {
    expect(cmllRevealText("unknown", "U' R U R'")).toBe("(U') R U R'")
})

it('prints the no-AUF reveal for each case', () => {
    console.log(cases.map(([id, alg]) => `${id}: ${cmllRevealText(id, alg)}`).join("\n"))
})

it('names every CMLL case, including NMCLL ids', () => {
    expect(Object.keys(cmll_case_names).sort()).toEqual(cases.map(([id]) => id).sort())
    expect(cmllCaseName("as_left_bar")).toBe("As Left Bar (D)")
    expect(cmllCaseName("nmcll-o_1-pi_columns")).toBe("Pi Columns")
    expect(cmllCaseName("some_new_case")).toBe("Some New Case")
    expect(cmllCaseName("solved")).toBe("CMLL Skip")
})
