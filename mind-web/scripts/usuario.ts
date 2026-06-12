/**
 * Cadastra/atualiza a senha de um usuário da Mind:
 *   npm run usuario -- <id> <senha>
 * Cria permissoes/usuarios.json (fora do Git) a partir do exemplo, se não existir.
 */
import fs from "node:fs";
import path from "node:path";
import { resolverDadosRaiz, type Usuario } from "../lib/core.ts";
import { hashSenha } from "../lib/auth.ts";

const [id, senha] = process.argv.slice(2);
if (!id || !senha) {
  console.log("Uso: npm run usuario -- <id> <senha>");
  process.exit(1);
}

const dir = path.join(resolverDadosRaiz(), "permissoes");
const arqReal = path.join(dir, "usuarios.json");
const origem = fs.existsSync(arqReal) ? arqReal : path.join(dir, "usuarios.exemplo.json");
const dados = JSON.parse(fs.readFileSync(origem, "utf8"));

const usuario = (dados.usuarios as Usuario[]).find((u) => u.id === id);
if (!usuario) {
  console.log(`Usuário '${id}' não existe. Disponíveis: ${dados.usuarios.map((u: Usuario) => u.id).join(", ")}`);
  console.log("Para criar um novo, adicione-o em permissoes/usuarios.json e rode de novo.");
  process.exit(1);
}
usuario.senha_hash = hashSenha(senha);
dados.descricao = "Usuários REAIS da Mind (com senha) — este arquivo fica fora do Git.";
fs.writeFileSync(arqReal, JSON.stringify(dados, null, 2) + "\n");
console.log(`✅ Senha de '${id}' gravada em permissoes/usuarios.json`);
