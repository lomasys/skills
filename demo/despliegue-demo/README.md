# Despliegue Demo

Proyecto de práctica **con problemas a propósito** para ver trabajar la skill [produccion](../../plugins/produccion/skills/produccion/SKILL.md).
Es una tienda inventada que está a punto de subir cambios a producción… y no debería.

Como necesita su propio historial de git (lo que ya está en producción y lo que viene), se genera con un script.

## Crear

Necesitas Node 18 o más nuevo, git y bash (en Windows, Git Bash). No hay que instalar nada.

```bash
bash crear-demo.sh ../despliegue-demo-practica   # una carpeta NUEVA; si ya existe con algo, el script no la toca
cd ../despliegue-demo-practica
npm test
```

El tag `v1.2.0` es lo que está en producción. Después hay 3 commits y cambios sin commit.

## Reto

Dentro de la carpeta generada, corre `/produccion:produccion` (o `errores errores.log`, `monitoreo`, `notas v1.2.0..HEAD`, `postmortem`).

<details>
<summary>Ver los problemas (spoiler)</summary>

1. Dos variables de entorno nuevas que no están ni en `.env.example` ni en `render.yaml`.
2. Una migración que borra la columna `telefono` mientras el código todavía la lee.
3. Una prueba fallando: el costo de envío siempre da 0.
4. Una bandera de función escrita fija en el código.
5. No hay plan escrito para regresar a la versión anterior ni archivo de versiones fijas.
6. Un commit con un nombre de cliente, un ticket y un arreglo de seguridad (para probar las notas para clientes).
7. Un commit cuyo título no coincide con lo que cambia.
8. `errores.log` con 5 causas mezcladas, una de ellas con una clave (falsa) escrita en el log.

</details>
