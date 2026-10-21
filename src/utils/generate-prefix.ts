// src/lib/generate-prefix.ts
import { normalizeText } from "../utils/validation.js";

/**
 * Gera um prefix de categoria (3-4 chars) a partir do nome.
 *
 * Regra (decidida em 10/10/2026):
 * - Normaliza: trim + colapsa espaços + NFD + remove acento + uppercase + filtra [A-Z0-9 ]
 * - 1 palavra  → 3 primeiras letras (padding 'X' se < 3)
 * - 2+ palavras → 3 primeiras da 1ª palavra + 1ª letra da 2ª palavra
 * - Colisão:
 *    - 1ª tentativa: adiciona a 4ª letra da 1ª palavra (se existir)
 *    - 2ª tentativa em diante: sufixo numérico (base + '1', base + '2', ...)
 * - A ordem de criação define quem fica com a base (Opção 1 aceita)
 */
export function generatePrefix(
  name: string,
  existingPrefixes: Set<string>,
): string {
  const normalized = normalizeForPrefix(name);
  if (!normalized) {
    throw new Error("Nome inválido para gerar prefix");
  }

  const words = normalized.split(" ").filter(Boolean);
  if (words.length === 0) {
    throw new Error("Nome inválido para gerar prefix");
  }

  let base: string;
  if (words.length === 1) {
    base = words[0].slice(0, 3);
    if (base.length < 3) base = base.padEnd(3, "X");
  } else {
    const w1 = words[0].slice(0, 3).padEnd(3, "X");
    const w2 = words[1][0];
    base = w1 + w2;
  }

  if (!existingPrefixes.has(base)) {
    return base;
  }

  if (words.length === 1) {
    const fourth = words[0][3];
    if (fourth) {
      const candidate = base + fourth;
      if (!existingPrefixes.has(candidate)) {
        return candidate;
      }
    }
  }

  let n = 1;
  while (existingPrefixes.has(`${base}${n}`)) {
    n++;
  }
  return `${base}${n}`;
}

function normalizeForPrefix(input: string): string {
  return normalizeText(input)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
