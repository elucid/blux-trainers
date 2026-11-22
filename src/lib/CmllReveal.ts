import { CubieCube, MoveSeq } from "./CubeLib";

// Justin's personal CMLL algs (source: "Current Justin CMLLs (single page).docx").
// Each alg is written as it appears on the sheet, i.e. relative to the sheet's
// orientation of the case. The pre-AUF needed for the orientation the trainer shows
// is worked out at reveal time, so no AUF should be baked in here.
// Use a list when a case has more than one alg; each alg is shown on its own line.
export const cmll_algs_justin: { [id: string]: string[] } = {
    o_adjacent_swap:    ["R U R' F' R U R' U' R' F R2 U' R'"],
    o_diagonal_swap:    ["r2 D r' U r D' r2' B r U' r' B'"],
    h_columns:          ["R U R' U R U' R' U R U2' R'"],
    h_rows:             ["F R U R' U' R U R' U' R U R' U' F'"],
    h_column:           ["R' F2 D R2 U R2 D' F2 R"],
    h_row:              ["r U' r2' D' r U' r' D r2 U r'"],
    pi_right_bar:       ["r' U r2 U' r2 U' r2 U r'"],
    pi_back_slash:      ["F R' F' R U2 R U' R' U R U2' R'"],
    pi_x_checkerboard:  ["R' F R U F U' R U R' U' F'"],
    pi_forward_slash:   ["R U2 R' U' R U R' U2' R' F R F'"],
    pi_columns:         ["r U' r2' D' r U r' D r2 U r'"],
    pi_left_bar:        ["R' U' R' F R F' R U' R' U2 R"],
    u_forward_slash:    ["R2 D R' U2 R D' R' U2 R'"],
    u_back_slash:       ["R2' D' R U2 R' D R U2 R"],
    u_front_row:        ["R' U' R U' R' U2' R2 U R' U R U2' R'"],
    u_rows:             ["F R2 D R' U R D' R2' U' F'"],
    u_x_checkerboard:   ["r U' r' U r' D' r U' r' D r"],
    u_back_row:         ["F R U R' U' F'"],
    t_left_bar:         ["R U R' U' R' F R F'"],
    t_right_bar:        ["L' U' L U L F' L' F"],
    t_rows:             ["R U2' R' U' R U' R2' U2' R U R' U R"],
    t_front_row:        ["r' U r U2' R2' F R F' R"],
    t_back_row:         ["r' D' r U r' D r U' r U r'"],
    t_columns:          ["r2' D' r U r' D r2 U' r' U' r"],
    s_left_bar:         ["R U R' U R U2 R'"],
    s_x_checkerboard:   ["r' F2 r U2' r U' r' F"],
    s_forward_slash:    ["F R' F' R U2 R U2' R'"],
    s_columns:          ["R' F2 R2 U2' R' F R U2' R2' F2 R"],
    s_right_bar:        ["R U R' U R' F R F' R U2' R'"],
    s_back_slash:       ["r U' r' F R' F' R"],
    as_right_bar:       ["R' U' R U' R' U2 R"],
    as_columns:         ["R' F2 R2 U2' R' F' R U2' R2' F2 R"],
    as_back_slash:      ["F' r U r' U2' r' F2 r"],
    as_x_checkerboard:  ["R U2' R' U2 R' F R F'"],
    as_forward_slash:   ["R' F R F' r U r'"],
    as_left_bar:        ["R U2' R' U' R U R2' F R F' R U2' R'"],
    l_mirror:           ["F R U' R' U' R U R' F'"],
    l_inverse:          ["F R' F' R U R U' R'"],
    l_pure:             ["R U R' U R U' R' U R U' R' U R U2 R'"],
    l_front_commutator: ["R U2 R D R' U2 R D' R2'"],
    l_diag:             ["R U2' R2' F R F' R U2' R'"],
    l_back_commutator:  ["R' U2 R' D' R U2 R' D R2"],
}

// Case names as written on the same sheet.
export const cmll_case_names: { [id: string]: string } = {
    o_adjacent_swap:    "O Adjacent Swap",
    o_diagonal_swap:    "O Diagonal Swap",
    h_columns:          "H Columns",
    h_rows:             "H Rows",
    h_column:           "H Column",
    h_row:              "H Row",
    pi_right_bar:       "Pi Right Bar",
    pi_back_slash:      "Pi Backslash",
    pi_x_checkerboard:  "Pi X Checkerboard",
    pi_forward_slash:   "Pi Forward Slash",
    pi_columns:         "Pi Columns",
    pi_left_bar:        "Pi Left Bar",
    u_forward_slash:    "U Forward Slash",
    u_back_slash:       "U Backslash",
    u_front_row:        "U Front Row",
    u_rows:             "U Rows",
    u_x_checkerboard:   "U X Checkerboard",
    u_back_row:         "U Back Row",
    t_left_bar:         "T Left Bar",
    t_right_bar:        "T Right Bar",
    t_rows:             "T Rows",
    t_front_row:        "T Front Row",
    t_back_row:         "T Back Row",
    t_columns:          "T Columns",
    s_left_bar:         "S Left Bar (O)",
    s_x_checkerboard:   "S X Checker (B)",
    s_forward_slash:    "S Fwd Slash (R)",
    s_columns:          "S Columns (F)",
    s_right_bar:        "S Right Bar (D)",
    s_back_slash:       "S Backslash (L)",
    as_right_bar:       "As Right Bar (O)",
    as_columns:         "As Columns (L)",
    as_back_slash:      "As Backslash (B)",
    as_x_checkerboard:  "As X Checker (R)",
    as_forward_slash:   "As Fwd Slash (F)",
    as_left_bar:        "As Left Bar (D)",
    l_mirror:           "L Mirror",
    l_inverse:          "L Inverse",
    l_pure:             "L Pure",
    l_front_commutator: "L Frnt Commutator",
    l_diag:             "L Diagonal",
    l_back_commutator:  "L Bck Commutator",
}

const AUFS = ["", "U", "U'", "U2"]

const cornersSolved = (c: CubieCube) =>
    c.cp.every((x, i) => x === i) && c.co.every(x => x === 0)

// Pre-AUF that makes `alg` solve the corners of the case set up by `caseAlg`.
// CMLL leaves the post-AUF free, so any final U-layer offset is accepted.
// Returns undefined if `alg` doesn't solve the case from any AUF.
export const findPreAuf = (caseAlg: string, alg: string): string | undefined => {
    const caseCube = new CubieCube().apply(new MoveSeq(caseAlg).inv())
    for (const pre of AUFS) {
        const solvedCube = caseCube.apply(new MoveSeq(pre + " " + alg))
        for (const post of AUFS) {
            if (cornersSolved(solvedCube.apply(new MoveSeq(post)))) return pre
        }
    }
    return undefined
}

// Default trainer display: collapsed alg with a leading U move pulled out as "(AUF)".
const formatDefault = (caseAlg: string) => {
    let text = ""
    const moves_c = new MoveSeq(caseAlg).collapse()
    if (moves_c.moves.length > 0) {
        if (moves_c.moves[0].name[0] === "U") {
            text += "(" + moves_c.moves[0].name + ") "
            moves_c.moves = moves_c.moves.slice(1)
        }
        text += moves_c.toString()
    }
    return text.trim()
}

export const normalizeAlg = (alg: string) => alg.replace(/[’‘`´]/g, "'").replace(/\s+/g, " ").trim()

// Case ids are either "<cmll_name>" or "nmcll-<group>-<cmll_name>".
const cmllNameOf = (caseId: string) => caseId.split("-").pop() || caseId

// Display name for a case id, falling back to a title-cased id ("as_left_bar" -> "As Left Bar").
export const cmllCaseName = (caseId: string): string => {
    const id = cmllNameOf(caseId)
    if (id === "solved") return "CMLL Skip" // corners already solved; at most an AUF
    return cmll_case_names[id] || id.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
}

// Text to show under "Case" for a revealed case.
// `caseAlg` is the alg the trainer used to set the case up (pre-AUF + default alg).
export const cmllRevealText = (caseId: string, caseAlg: string): string => {
    const userAlgs = cmll_algs_justin[cmllNameOf(caseId)]
    if (!userAlgs || userAlgs.length === 0) return formatDefault(caseAlg)
    return userAlgs.map(raw => {
        const alg = normalizeAlg(raw)
        const pre = findPreAuf(caseAlg, alg)
        if (pre === undefined) return alg + " (doesn't solve this case?)"
        return pre ? `(${pre}) ${alg}` : alg
    }).join("\n")
}
