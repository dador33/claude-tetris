---
description: Crea un git worktree aislado en .trees/<nombre> y ejecuta ahí las instrucciones recibidas
argument-hint: <instrucciones a ejecutar en el worktree>
---

Instrucciones recibidas: $ARGUMENTS

Sigue estos pasos en orden.

## 1. Elegir el nombre

Deduce un nombre corto a partir de las instrucciones: kebab-case, minúsculas, sin acentos ni espacios, máximo 40 caracteres (por ejemplo `pausa-con-p` o `fix-hold-bug`). Si `.trees/<nombre>` o la rama `<nombre>` ya existen, añade un sufijo (`-2`, `-3`...). No sobrescribas nada existente.

## 2. Crear el worktree

1. Comprueba que `.trees/` está ignorado: `git check-ignore -q .trees`. Si no lo está, añade `.trees/` a `.git/info/exclude` (es local y no modifica el repo). No edites `.gitignore`.
2. Ejecuta desde la raíz del repo: `git worktree add .trees/<nombre>`
3. Si el comando falla, informa del error exacto y detente.

## 3. Ejecutar las instrucciones en el worktree

- Trabaja solo dentro de `.trees/<nombre>`. Usa rutas absolutas que empiecen por `<raíz del repo>/.trees/<nombre>/`.
- No leas ni modifiques archivos del árbol principal. No cambies de rama en el árbol principal.
- Para comandos de Bash, entra al worktree en cada llamada (`cd <ruta absoluta>/.trees/<nombre> && ...`).
- Sigue las reglas de CLAUDE.md (por ejemplo, correr `node tests.js` si tocas `rules.js`). Para probar en navegador, sirve el worktree en un puerto distinto de 8000 para no chocar con el árbol principal.
- No hagas commit, push ni PR salvo que las instrucciones lo pidan.

## 4. Informar

Al terminar, di en pocas líneas: nombre y ruta del worktree, rama creada, resumen de los cambios y cómo integrarlos o limpiarlos (`git worktree remove .trees/<nombre>`).

Si `$ARGUMENTS` está vacío, no crees nada: pide las instrucciones al usuario.
