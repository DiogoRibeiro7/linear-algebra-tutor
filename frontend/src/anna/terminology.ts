/**
 * Curated English/Portuguese linear-algebra vocabulary for lexical retrieval.
 *
 * These are equivalent technical terms, not general-purpose translations or
 * embeddings. Canonicalizing both the question and course text preserves BM25's
 * lexical interpretation while handling spelling and common plural forms.
 */
const TERM_GROUPS: readonly (readonly string[])[] = [
  ['vector', 'vectors', 'vetor', 'vetores', 'vetorial', 'vetoriais'],
  ['matrix', 'matrices', 'matriz', 'matrizes'],
  ['addition', 'add', 'adding', 'sum', 'somar', 'soma', 'adicao'],
  ['multiplication', 'multiply', 'multiplying', 'multiplicar', 'multiplicacao'],
  ['product', 'produto'],
  ['scalar', 'escalar', 'escalares'],
  ['system', 'systems', 'sistema', 'sistemas'],
  ['linear', 'lineares'],
  ['gaussian', 'gauss'],
  ['elimination', 'eliminacao'],
  ['equation', 'equations', 'equacao', 'equacoes'],
  ['basis', 'bases', 'base'],
  ['independence', 'independent', 'independencia', 'independentes'],
  ['space', 'spaces', 'espaco', 'espacos'],
  ['subspace', 'subspaces', 'subespaco', 'subespacos'],
  ['transformation', 'transformations', 'transformacao', 'transformacoes'],
  ['kernel', 'nucleo', 'nucleos'],
  ['image', 'imagem', 'imagens'],
  ['determinant', 'determinants', 'determinante', 'determinantes'],
  ['geometric', 'geometry', 'geometrically', 'geometrico', 'geometria'],
  ['eigenvalue', 'eigenvalues', 'autovalor', 'autovalores'],
  ['eigenvector', 'eigenvectors', 'autovetor', 'autovetores'],
  ['orthogonal', 'orthogonality', 'ortogonal', 'ortogonais', 'ortogonalidade'],
  ['projection', 'projections', 'projecao', 'projecoes'],
  ['least', 'minimo', 'minimos'],
  ['square', 'squares', 'quadrado', 'quadrados'],
  ['rank', 'posto'],
  ['inner', 'interno'],
  ['inverse', 'inversa', 'inverso'],
  ['solution', 'solutions', 'solucao', 'solucoes'],
  ['calculate', 'calculated', 'compute', 'computed', 'calcular', 'calculo'],
  ['solve', 'solving', 'resolver'],
];

const aliases = new Map<string, string>();
for (const [canonical, ...terms] of TERM_GROUPS) {
  if (!canonical) throw new Error('Terminology group has no canonical term');
  for (const term of [canonical, ...terms]) {
    if (aliases.has(term) && aliases.get(term) !== canonical) {
      throw new Error(`Ambiguous terminology alias: ${term}`);
    }
    aliases.set(term, canonical);
  }
}

/** Input terms must already be lowercase and accent-normalized. */
export function canonicalTerm(term: string): string {
  return aliases.get(term) ?? term;
}
