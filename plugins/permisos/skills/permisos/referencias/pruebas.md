# Pruebas de permisos por rol

Una sola tabla de casos genera todas las pruebas: **acción × usuario → esperado**. El esperado sale de la columna del negocio del mapa.

## Usuarios que siempre van

| Usuario | Para qué |
|---|---|
| Uno por cada rol de la cuenta A | La tabla principal |
| Admin de la cuenta B | Que un admin de otra cuenta no toque nada de A (**el más olvidado**) |
| Sin sesión | Todo lo privado responde 401 o redirige al login |

Usa las ayudas de login y arranque que exporte el proyecto. Si están dentro de un archivo de pruebas y no se exportan,
cópialas al inicio de tu archivo: no edites el archivo existente. Ojo: `node --test` corre cualquier `.js` dentro de `test/`,
así que un archivo de ayudas ahí también cuenta como prueba.

Los registros que se editan o borran los crea la propia prueba. Cada prueba empieza con datos limpios
(transacción que se deshace, base de pruebas que se vacía, o datos en memoria nuevos).

## Qué cuenta como "denegado"

`401`, `403` o `404` (el 404 es mejor para otra cuenta: no confirma que el registro existe). Un `200` con lista vacía también vale
en listados de otra cuenta. **Nunca** cuentes un `500` como denegado: es una falla aparte.
Para "permitido", acepta `200`, `201`, `204` o la redirección normal de la app.

Para acciones que cambian datos, además del código de respuesta revisa que **el cambio no quedó** cuando debía negarse
(por ejemplo, pide el rol del usuario después del `PATCH`).

## Pruebas que fallan

Se quedan fallando: cada una es un hallazgo. No las marques con `skip`, `todo`, `xfail` ni `pending`.
Si el usuario pide la suite en verde mientras arregla, márcalas **con su permiso** y con el número del hallazgo en el nombre.

## Ejemplos por stack

### Node (`node --test`, Jest, Vitest)

```js
const casos = [
  // [nombre, método, ruta, cuerpo, { admin, editor, lector, otraCuenta }]
  ['exportar', 'GET', '/api/documentos/exportar', null, { admin: true, editor: false, lector: false, otraCuenta: false }],
  ['cambiar rol', 'PATCH', '/api/usuarios/3/rol', { rol: 'admin' }, { admin: true, editor: false, lector: false, otraCuenta: false }],
];
for (const [nombre, metodo, ruta, cuerpo, esperado] of casos) {
  for (const [quien, permitido] of Object.entries(esperado)) {
    test(`${nombre}: ${quien} ${permitido ? 'puede' : 'no puede'}`, async () => {
      const { base, cerrar } = await arrancar();           // usa la ayuda que ya tenga el proyecto
      try {
        const cookie = await entrar(base, usuarios[quien]);
        const r = await fetch(base + ruta, { method: metodo, headers: { cookie }, body: cuerpo && JSON.stringify(cuerpo) });
        if (permitido) assert.ok(r.status < 400, `esperaba permitido, llegó ${r.status}`);
        else assert.ok([401, 403, 404].includes(r.status), `esperaba denegado, llegó ${r.status}`);
      } finally { cerrar(); }
    });
  }
}
```

### Rails (RSpec request specs)

```ruby
CASOS = {
  [:get, "/documentos/exportar"] => { admin: true, editor: false, lector: false, otra_cuenta: false },
}
CASOS.each do |(verbo, ruta), esperado|
  esperado.each do |quien, permitido|
    it "#{verbo} #{ruta}: #{quien} #{permitido ? 'puede' : 'no puede'}" do
      sign_in usuarios.fetch(quien)
      send(verbo, ruta)
      permitido ? expect(response.status).to(be < 400) : expect(response.status).to(be_in([401, 403, 404]))
    end
  end
end
```

Si usa Pundit, agrega también pruebas de la política (`permissions :export?`), pero **no en lugar** de las de petición:
la política puede estar bien y la ruta no llamarla.

### Django (pytest-django o `TestCase`)

```python
@pytest.mark.parametrize("quien,permitido", [("admin", True), ("editor", False), ("lector", False), ("otra_cuenta", False)])
def test_exportar(client, usuarios, quien, permitido):
    client.force_login(usuarios[quien])
    r = client.get("/api/documentos/exportar/")
    assert (r.status_code < 400) if permitido else (r.status_code in (401, 403, 404))
```

### Laravel (PHPUnit / Pest)

```php
dataset('exportar', [['admin', true], ['editor', false], ['lector', false], ['otra_cuenta', false]]);
it('exportar', function (string $quien, bool $permitido) {
    $r = $this->actingAs(usuario($quien))->get('/api/documentos/exportar');
    $permitido ? expect($r->status())->toBeLessThan(400) : expect($r->status())->toBeIn([401, 403, 404]);
})->with('exportar');
```

## Pruebas extra de alcance

Para exportaciones, búsquedas, listados y descargas, el código de respuesta no basta: revisa que **el contenido** solo traiga
registros de la cuenta del usuario (`todos los cuentaId === el mío`).
