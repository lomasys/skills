# Textos y traducciones

Cuatro problemas: **textos fijos** (escritos en el código en lugar de pasar por las traducciones),
**llaves que faltan** en un idioma, **llaves crudas** en pantalla (`dashboard.title`) y **frases que el usuario no debería ver**
(técnicas o en el idioma equivocado).

## Con la herramienta

```bash
node <skill>/scripts/pantallas.mjs textos src/
node <skill>/scripts/pantallas.mjs textos . --llaves config/locales/es.yml,config/locales/en.yml   # si no encuentra los archivos sola
node <skill>/scripts/pantallas.mjs textos src/ --json > <tmp>/textos.json                          # para contar o filtrar
```

Encuentra sola los archivos de traducción que están en carpetas `locales/`, `locale/`, `i18n/`, `lang/`, `translations/`, `l10n/` o `messages/`, más los `.arb` y `.po`.
Da cuatro listas:

| Lista | Qué significa | Gravedad típica |
|---|---|---|
| Llaves usadas que no existen | Se ve la llave cruda. Si falta en **todos** los idiomas, la ve todo el mundo | 🔴 en títulos, botones y mensajes de error |
| Llaves que faltan en un idioma | Se ve cruda (o en el idioma de respaldo) para los clientes de ese idioma | 🟠 |
| Valores sospechosos | Vacíos, iguales a la llave, en el otro idioma ("Cancel" en es) o con frases técnicas | 🟡 |
| Textos fijos | Candidatos escritos en el código. **Confírmalos**: un nombre de marca o un símbolo no se traduce | 🟡 (🟠 si el producto ya tiene más de un idioma) |

Si el proyecto **no** tiene sistema de traducciones y solo habla un idioma, los textos fijos no son hallazgo: revisa solo idioma, tono y frases técnicas.

## Sistemas por stack

| Stack | Archivos | Cómo se usa una llave | Ojo con |
|---|---|---|---|
| React (i18next, react-intl) | `public/locales/<idioma>/<ns>.json`, `src/i18n/*.json` | `t('clientes.titulo')`, `<Trans i18nKey>`, `intl.formatMessage({ id })` | Espacios de nombres: `t('comun:guardar')` |
| Vue (vue-i18n) | `src/locales/*.json`, bloques `<i18n>` | `$t('clave')`, `t('clave')`, `v-t="'clave'"` | Bloques `<i18n>` dentro del `.vue` |
| Svelte (svelte-i18n) | `src/lib/i18n/*.json` | `$_('clave')`, `$t('clave')` | |
| Angular (ngx-translate / i18n nativo) | `src/assets/i18n/*.json`, `messages.*.xlf` | `{{ 'clave' \| translate }}`, atributo `i18n` | Con i18n nativo, los textos con `i18n="@@id"` sí están traducidos |
| Rails | `config/locales/*.yml` | `t('.titulo')` (relativa a la vista), `t('clientes.titulo')` | Las llaves que empiezan con `.` dependen de la ruta de la vista: búscalas a mano |
| Django | `locale/<idioma>/LC_MESSAGES/django.po` | `{% trans "Texto" %}`, `{% translate %}`, `_("Texto")` | La "llave" es el texto en el idioma base; revisa `msgstr ""` vacíos y `#, fuzzy` |
| Laravel | `lang/<idioma>/*.php`, `lang/<idioma>.json` | `__('archivo.llave')`, `@lang`, `trans()` | El JSON usa el texto completo como llave |
| Flutter (intl / gen-l10n) | `lib/l10n/app_<idioma>.arb` | `AppLocalizations.of(context)!.llave`, `S.of(context).llave` | `Text('…')` literal es texto fijo |

## Cómo confirmar una llave cruda

1. La herramienta dice `archivo:línea` y en qué idiomas falta.
2. Abre la captura (o el DOM) de esa pantalla: si ves `dashboard.title` tal cual, ya está comprobado.
3. Revisa si hay **idioma de respaldo** (`fallbackLng`, `config.i18n.fallbacks`, `fallback_locale`): con respaldo, el usuario ve el otro idioma en lugar de la llave. Sigue siendo hallazgo, pero 🟡.

## Frases que el usuario final no debe ver

- **Técnicas:** `undefined`, `null`, `NaN`, `[object Object]`, `Error: fetch failed`, `ECONNREFUSED`, `500`, `forbidden`, el mensaje crudo de la excepción, nombres de tablas o campos.
  Busca dónde se muestra `error.message` o la respuesta del servidor tal cual.
- **Idioma equivocado:** "Loading...", "Not implemented yet", "Cancel" en una app en español, o al revés.
- **Fechas, números y dinero sin formato del idioma:** `2026-10-02`, `$1290`. Propón `Intl.DateTimeFormat` / `Intl.NumberFormat`, `l()` en Rails, `date`/`floatformat` en Django, `DateFormat` en Flutter. Es 🟡 o ⚪.

## Cómo escribir el cambio

Para cada texto fijo o llave que falta, da las tres partes:

````markdown
- **Cambio propuesto:**
  ```diff
  # public/app.js:11
  - lista.textContent = 'Loading...';
  + lista.textContent = t('comun.cargando');
  ```
  Llave nueva `comun.cargando`: es → "Cargando…" · en → "Loading…"
````

Usa el estilo de llaves que ya tiene el proyecto (agrupadas por pantalla o por tipo). Si una llave existe con el mismo texto, reúsala (`acciones.guardar` para "Guardar") en lugar de crear otra.
