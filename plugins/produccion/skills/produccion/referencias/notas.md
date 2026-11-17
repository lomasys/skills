# Notas para clientes

Convierte lo terminado en novedades que un cliente entiende y le importan. Nada técnico, nada interno.

## De dónde sale

```bash
git log --no-merges --pretty='%h %s' <rango>        # ej. v1.2.0..HEAD, o --since=2026-11-01
git log --merges --pretty='%h %s %b' <rango>        # títulos de PRs fusionados
gh pr list --state merged --search "merged:>=AAAA-MM-DD" --json number,title,body   # si usan GitHub y gh está instalado
```

Más el `CHANGELOG.md`. **Lee el diff de cada cambio**, no solo el título: el título puede prometer algo que el código no hace.

## Qué entra y qué no

Antes de escribir, clasifica cada cambio:

| Cambio | ¿Entra? | Cómo |
|---|---|---|
| Función nueva que el cliente ve | Sí | Lo que ahora puede hacer y para qué le sirve |
| Mejora de algo que ya usa (más rápido, más fácil) | Sí | El beneficio, sin cómo se hizo |
| Error que los clientes notaron | Sí, sin drama | "Ahora X funciona bien cuando Y" |
| Cambio que le cuesta o le quita algo (precio, envío, un dato que ya no se guarda) | Sí, **claro y primero** | Qué cambia, desde cuándo y qué tiene que hacer |
| Arreglo de seguridad | **No** | Ni "más seguridad en X": avisa que existió el hoyo. Si hay que avisar a afectados, eso es un aviso aparte que decide el usuario |
| Refactor, pruebas, CI, dependencias, nombres internos | No | — |
| Cambio que aún no está publicado | No | Sepáralo en "pendiente de publicar" |
| Cambio a medias o detrás de una bandera apagada | No | — |

## Lo que nunca aparece

- Nombres de clientes, empresas, personas del equipo o proveedores internos.
- Números de ticket, de PR, de commit, de versión interna.
- Nombres de archivos, tablas, servicios, endpoints, librerías ("servicio de facturación", "users.rb", "webhook").
- Siglas técnicas (IDOR, API, CSV sin explicar → "archivo para Excel").
- Hoyos de seguridad, fallas de datos, incidentes, aunque estén arreglados.
- Promesas de fechas para lo que viene.

Antes de entregar, relee el texto buscando cada nombre propio, número y palabra técnica del log de git. Si aparece, fuera.

## Cómo escribirlo

- Título corto con el beneficio, luego una o dos frases: qué puede hacer ahora y dónde.
- Segunda persona ("ya puedes…"), frases cortas, sin jerga.
- Lo que cambia o cuesta algo va primero, nunca escondido al final.
- Pocas novedades buenas valen más que una lista larga. Si solo hay cambios internos, dilo: no hay novedades para clientes.

## Formato del reporte

```markdown
**Novedades — <mes o versión pública>**

**<Beneficio en pocas palabras>.** <Qué puede hacer ahora y dónde.>

**<Cambio que le afecta>.** <Qué cambia, desde cuándo y si tiene que hacer algo.>
```

Después, aparte y solo para el usuario:

```markdown
**Lo que dejé fuera**
| Cambio | Por qué |
|---|---|
| arreglo de acceso a reportes | arreglo de seguridad: no se anuncia |
| actualización de librerías | interno |
| nuevo plan anual | aún no está publicado |
```
