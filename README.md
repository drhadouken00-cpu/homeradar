# HomeRadar

Web estática con nueve referencias oficiales revisadas de Madrid y un adaptador para el sumario abierto del BOE. La pestaña Boletines presenta documentos hallados por título. Consulta cada documento para conocer su ámbito y vigencia. La cobertura de portales privados se ofrece mediante enlaces.

## Abrir en desarrollo

Desde el directorio del proyecto ejecuta `python -m http.server 8000 --directory public` y abre http://localhost:8000. El HTML web carga un JSON por HTTP. La versión HTML autónoma sigue disponible como archivo independiente.

## Publicar y activar las revisiones

Sube el contenido de este directorio a un repositorio **público** cuyo branch predeterminado sea main. Usa únicamente ejecutores estándar de GitHub Actions. El repositorio no contiene datos de perfiles ni secretos.

En Cloudflare Pages Free, conecta ese repositorio mediante integración Git, elige main, deja el comando de compilación vacío e indica `public` como directorio de salida. Usa el subdominio pages.dev incluido. Mantén desactivados los servicios de pago. Cada cambio del catálogo en main activa el despliegue de Pages.

Ejecuta manualmente la acción **Actualizar HomeRadar** para comprobar la conexión real al BOE y el despliegue automático. La acción también está configurada a las 08:00, 15:00 y 21:00 hora de Madrid. Las ejecuciones programadas pueden retrasarse y GitHub puede desactivarlas en repositorios públicos inactivos. Comprueba que la URL funciona en sesión anónima.

## Datos y recuperación

Solo se consultan los últimos cinco días del sumario abierto. Se conservan las referencias editoriales y hasta 200 referencias de boletín. Si falla todo el acceso al BOE, se conserva y sirve el índice anterior. Si un día falla temporalmente, entra en la ventana de recuperación de los siguientes barridos. La fecha mostrada corresponde al último sumario leído, aunque existan días anteriores pendientes. Ante 403 o 429 se interrumpe el barrido actual.

Para corregir o retirar una ficha editorial, edita public/catalog.json y conserva su ID para que los favoritos existentes sigan funcionando. Puedes recuperar el índice con Git o publicar la carpeta public en otro alojamiento estático.

Fuente BOE y condiciones: https://www.boe.es/datosabiertos/api/api.php

