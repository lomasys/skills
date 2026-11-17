# Pruebas que sí prueban algo · pruebas inestables y lentas · bugs

## Cómo correr una sola prueba por stack

| Stack | Archivo | Una prueba por nombre |
|---|---|---|
| Node (`node --test`) | `node --test test/x.test.js` | `node --test --test-name-pattern="nombre" test/x.test.js` |
| Jest / Vitest | `npx jest ruta` · `npx vitest run ruta` | `-t "nombre"` |
| Rails (RSpec / Minitest) | `bundle exec rspec spec/x_spec.rb` · `bin/rails test test/x_test.rb` | `spec/x_spec.rb:42` · `-n /nombre/` |
| Django / pytest | `python -m pytest tests/test_x.py` · `python manage.py test app.tests.TestX` | `-k nombre` |
| Laravel (PHPUnit / Pest) | `php artisan test tests/Feature/XTest.php` | `--filter nombre` |

Usa siempre el comando que el proyecto ya usa (`package.json`, `Makefile`, `bin/`, CI) para no cambiar el ambiente.

## Modo `bug`: reproducir primero

1. Traduce la queja a un caso concreto con números: entrada exacta y salida esperada. Si la salida esperada depende de una regla de negocio que no está escrita, **pregunta**
   y muestra el resultado de cada opción (en el ejemplo de abajo, 114.84 solo es correcto si el cupón aplica a todo el carrito).
   Mientras esperas, escribe las pruebas que no dependen de la regla (el orden de los artículos no cambia el total, el carrito vacío no truena).
2. Escribe la prueba **en el estilo del proyecto**, junto a las demás de esa parte, con un nombre que describa el error ("cupón DESC10 con varios artículos").
3. Córrela. Debe **fallar**, y por la razón correcta: compara el mensaje (esperado 114.84, recibido 116). Si falla por otra cosa (importación, datos), arréglalo hasta que falle por el bug.
   Si no falla, no reproduciste el error: busca otra entrada.
4. Corre `impacto` sobre lo que vas a tocar. Un arreglo también cambia resultados para todos los demás que usan esa función.
5. Propón el arreglo mínimo. Con permiso, aplícalo, corre la prueba (pasa) y luego la suite completa.
6. Agrega casos de borde cercanos que encontraste (vacío, cero, uno, muchos) si fallan hoy.

## Modo `pruebas`: encontrar pruebas que no prueban nada

### Paso 1: sospechosas por patrón

| Señal | Ejemplo |
|---|---|
| Sin aserciones | `test('genera factura', () => { generarFactura(p) })`: solo falla si lanza un error |
| Aserción trivial | `assert.ok(r)`, `expect(x).toBeDefined()`, `toBeTruthy()`, `assert x is not None`, `expect(response).to be_present` |
| Revisa la forma, no el valor | `typeof total === 'number'`, `toHaveProperty('total')`, código 200 sin revisar el cuerpo |
| Todo simulado (mock) | Se simula la misma función que se quiere probar, o todo lo que llama; la prueba solo comprueba que el mock regresó lo que se le dijo |
| Copia la lógica | El valor esperado se calcula con la misma fórmula que el código (`expect(total).toBe(precio * 1.16)`) |
| Captura y calla | `try { ... } catch {}` dentro de la prueba, `rescue nil`, `except: pass` |
| Promesa sin esperar | Falta `await` o `return`: la prueba termina antes de revisar |
| Saltada o enfocada | `skip`, `xit`, `.only`, `@pytest.mark.skip`, `pending` olvidados |
| Un solo caso | Prueba el caso fácil (un artículo) y nunca el que importa (varios artículos, vacío, negativo) |

### Paso 2: demostrarlo con una mutación manual

Una mutación es un error **puesto a propósito** para ver si alguna prueba se da cuenta.

1. Haz una copia del proyecto en tu carpeta de trabajo (sin `node_modules`, `vendor` ni `.venv`; si hacen falta, enlázalos o corre desde la copia apuntando a los del original solo para leer).
   Si no puedes copiar: muta en el repo **un archivo sin cambios pendientes**, corre y regrésalo en el mismo comando, y confirma `git diff -- <archivo>` vacío.
2. Elige una mutación **pequeña y realista** en el código que la prueba dice cubrir:

   | Mutación | Ejemplo |
   |---|---|
   | Cambiar un número | `0.16` → `0.5`; `* 0.1` → `* 0.2` |
   | Regresar algo fijo o vacío | `return 0`, `return null`, `return NaN`, `return []` |
   | Invertir una condición | `>` → `>=`, `===` → `!==`, quitar un `!` |
   | Quitar una línea | quitar el descuento, quitar la validación, quitar el guardado |

3. Corre **solo** las pruebas que dicen cubrir ese código.
   - Alguna falla → la prueba sí protege. ✅
   - Todas pasan → la prueba **no prueba eso**. Es un hallazgo comprobado.
4. Regresa el cambio (o borra la copia) y anota mutación → resultado en el reporte.

Haz entre 3 y 8 mutaciones, en el código que más dinero o clientes toca. No hace falta mutar todo.
Si el proyecto ya tiene una herramienta de mutación (Stryker, mutmut, mutant, Infection), puedes usarla; no la instales sin preguntar.

### Propuesta para cada prueba débil

Escribe la aserción concreta que falta (`assert.strictEqual(r.total, 114.84)`), no "mejorar la prueba". Si el valor correcto es una regla de negocio, pregúntalo.

## Modo `inestables`: fallan al azar o tardan

### Encontrarlas

1. Corre la suite completa una vez con tiempos (`--reporter=spec`, `--durations=10` en pytest, `--profile` en RSpec, `--verbose` en Jest) y anota las 10 más lentas.
2. Corre con la herramienta de la skill, archivo por archivo o la suite entera:
   `node <skill>/scripts/repetir.mjs --veces 20 -- <comando>`. Para sospechosas, sube a 50.
   Una que falla 1 de cada 10 tiene 12 % de probabilidad de no salir en 20 corridas: si sospechas, corre más,
   o reproduce la causa en memoria (por ejemplo, genera 100 000 valores y cuenta cuántos rompen la regla).
   Los tiempos de la herramienta incluyen el arranque del comando: para comparar lentitud usa la mediana, o la duración que reporta el propio framework.
3. Prueba también **el orden**: corre la prueba sola, y la suite en otro orden si el framework lo permite
   (`--random-order`/`--seed` en RSpec, `-p randomly` en pytest si ya está, `--randomize` en Jest/Vitest). Si pasa sola y falla en grupo, es orden o datos compartidos.

### La causa (busca en el código, no adivines)

| Causa | Señales en el código | Arreglo |
|---|---|---|
| **Azar** | `Math.random`, `rand`, `random.`, `uuid`, `faker` sin semilla | Fijar semilla o inyectar el generador; en la prueba, controlar el valor |
| **Hora y fecha** | `new Date()`, `Date.now`, `Time.now`, `datetime.now`, `now()`, zonas horarias, "fin de mes", "fin de semana" | Reloj falso (`mock.timers`, `useFakeTimers`, `travel_to`, `freezegun`, `Carbon::setTestNow`) o pasar la fecha como parámetro |
| **Esperas fijas** | `setTimeout`, `sleep`, `wait(1500)` "a que termine" | Esperar el evento o la promesa; si el código es síncrono, quitar la espera |
| **Orden y datos compartidos** | Variables globales, singletons, base de datos sin limpiar, archivos en `/tmp` con el mismo nombre, caché | Cada prueba crea y limpia sus datos; transacciones por prueba |
| **Red** | Llamadas reales a APIs, DNS, servicios externos | Simular la respuesta en la frontera (no la lógica propia) |
| **Concurrencia** | Pruebas en paralelo que usan el mismo puerto, archivo o fila | Puertos libres (`0`), nombres únicos, datos por prueba |
| **Recursos de la máquina** | Fallan solo en CI o con la máquina cargada; límites de tiempo muy justos | Quitar la dependencia del tiempo de reloj; subir el límite solo si la operación es legítimamente lenta |

Cuando la causa es azar u hora, a veces **el error está en el código**, no en la prueba (por ejemplo, un folio que a veces sale con 3 dígitos). Dilo.

### Reporte de cada una

`<archivo>:<línea>` · falla X de N corridas (o tarda Y ms) · causa con la línea del código · arreglo propuesto.
Nunca propongas "reintentar la prueba" ni "subir la espera" como arreglo principal.
