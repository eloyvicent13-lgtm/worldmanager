# World Manager para Pterodactyl

Addon que añade una pestaña **World Manager** en la barra lateral del servidor, visible
solo en servidores de Minecraft. Gestiona los mundos al estilo Aternos: descargar, subir,
activar, duplicar, renombrar, resetear y borrar mundos, además de editar los ajustes del
mundo (`server.properties`) desde la interfaz.

No depende de Blueprint ni de ningún otro framework: parchea el panel directamente y se
instala/desinstala con un comando.

---

## Requisitos

| Requisito | Detalle |
|---|---|
| Pterodactyl Panel | 1.11.x y 1.12.x (verificado contra 1.12.3 y 1.11.11) |
| Acceso | root (sudo) en la máquina del panel |
| Herramientas | `php`, `python3`, `curl`, `tar`, y `yarn` + Node 16/18 para recompilar el frontend |
| RAM libre | ~2 GB durante `yarn build:production` |

Funciona con temas personalizados siempre que el tema siga usando
`resources/scripts/routers/routes.ts` para construir el menú lateral (lo normal).

---

## Instalación

En el servidor del panel, como root:

```bash
bash <(curl -sSL https://raw.githubusercontent.com/eloyvicent13-lgtm/worldmanager/main/install.sh)
```

El instalador copia los archivos, aplica los parches, recompila el frontend, limpia las
cachés e instala el comando `world-manager`.

### Variables opcionales

| Variable | Por defecto | Para qué sirve |
|---|---|---|
| `PANEL_DIR` | `/var/www/pterodactyl` | Ruta del panel |
| `WORLD_MANAGER_REF` | `main` | Rama o tag a instalar |
| `SKIP_BUILD` | `0` | `1` para no recompilar el frontend (lo harás tú) |

---

## Actualizar y desinstalar

```bash
world-manager version      # versión instalada
world-manager update       # reinstala la última versión de tu repositorio
world-manager uninstall    # revierte todos los parches y borra los archivos
```

La desinstalación restaura los archivos originales del panel desde
`/var/www/pterodactyl/.world-manager/backup/` y recompila el frontend. **No toca ningún
archivo dentro de los servidores**: mundos y `server.properties` quedan intactos.

---

## Qué hace el addon

### Pestaña *Worlds*

- **Lista de mundos**: detecta cualquier carpeta con `level.dat` en la raíz del servidor y
  agrupa automáticamente sus dimensiones (`_nether`, `_the_end`).
- **Activar**: escribe `level-name` en `server.properties`. El mundo se carga al reiniciar.
- **Descargar**: Wings comprime el mundo y el navegador lo descarga con una URL firmada de
  15 minutos. El panel no hace de proxy, así que el tamaño solo lo limita el disco del nodo.
- **Subir**: el archivo `.zip` / `.tar.gz` va directo a Wings; el panel solo pide que lo
  descomprima. Busca `level.dat` dentro del archivo (funciona tanto si comprimiste la
  carpeta del mundo como su contenido) y nunca sobrescribe un mundo existente.
- **Duplicar / Renombrar**: incluye las dimensiones; renombrar el mundo activo actualiza
  `level-name` automáticamente.
- **Resetear**: borra los datos del mundo dejando `level-name` intacto, opcionalmente con
  una semilla nueva, para que el servidor regenere el mundo al arrancar.
- **Borrar**: requiere escribir el nombre del mundo y no permite borrar el mundo activo.

### Pestaña *World settings*

Edita el subconjunto de `server.properties` que afecta al mundo y a la partida: modo de
juego, dificultad, hardcore, PvP, vuelo, estructuras, Nether, spawn de mobs, protección de
spawn, distancia de render y simulación, jugadores máximos, MOTD, whitelist, semilla, tipo
de mundo, etc. El resto del archivo (comentarios, claves no listadas y su orden) se
conserva tal cual.

### Seguridad

- Todas las rutas van bajo el stack de middleware del cliente de Pterodactyl, así que
  respetan sesión, API keys y permisos de subusuario (`file.read`, `file.update`,
  `file.create`, `file.delete`, `file.archive`).
- Los servidores que no son de Minecraft devuelven **404** en todos los endpoints, aunque
  se llame a la API directamente.
- Importar, resetear, renombrar y borrar exigen que el servidor esté parado (Minecraft
  mantiene el mundo en memoria y lo reescribiría al apagarse).
- Los nombres de mundo se sanean contra `../` y separadores de ruta.

---

## Detección de Minecraft

Se comprueba en dos sitios y con las mismas señales:

1. El egg declara la feature `eula`.
2. El nombre del egg, del nest o la imagen Docker contienen `minecraft`, `paper`, `purpur`,
   `spigot`, `forge`, `fabric`, `bedrock`, `velocity`, `java`, etc.
3. (Solo backend, como último recurso) existe `server.properties` en la raíz del servidor.

El frontend usa 1 y 2 para decidir si muestra el enlace del menú; el backend repite la
comprobación en cada petición.

---

## Archivos que toca en el panel

Nuevos (se borran al desinstalar):

```
app/WorldManager/                      lógica y controlador
routes/worldmanager.php                rutas de la API cliente
resources/scripts/worldmanager/        interfaz React
.world-manager/                        copias de seguridad, versión y patch.py
.world-manager/assets-backup/          public/assets tal como estaban antes de instalar
```

Parcheados (con marcadores `world-manager` y copia de seguridad previa):

```
routes/api-client.php                  monta el grupo de rutas del addon
resources/scripts/routers/routes.ts    añade la ruta y el nombre del menú
resources/scripts/routers/ServerRouter.tsx   monta el guard del enlace lateral
```

### Si un parche falla

El instalador te dirá qué archivo no pudo tocar. Aplícalo a mano y vuelve a ejecutarlo.

**`routes/api-client.php`** — añade al final:

```php
// world-manager:start
Route::group([
    'prefix' => '/servers/{server}/world-manager',
    'middleware' => [
        ServerSubject::class,
        AuthenticateServerAccess::class,
        ResourceBelongsToServer::class,
    ],
], base_path('routes/worldmanager.php'));
// world-manager:end
```

**`resources/scripts/routers/routes.ts`** — importa el contenedor y añade la entrada al
final del array `server`:

```ts
import WorldManagerContainer from '@/worldmanager/WorldManagerContainer'; // world-manager
```

```ts
        // world-manager:start
        {
            path: '/world-manager',
            permission: 'file.*',
            name: 'World Manager',
            component: WorldManagerContainer,
        },
        // world-manager:end
```

**`resources/scripts/routers/ServerRouter.tsx`** — importa el guard y móntalo dentro del
JSX del router (junto a `<WebsocketHandler />` o al navegador lateral):

```tsx
import WorldManagerGuard from '@/worldmanager/WorldManagerGuard'; // world-manager
```

```tsx
<WorldManagerGuard />{/* world-manager */}
```

Sin este último parche la página sigue funcionando por URL, pero no habrá enlace en la
barra lateral y, en el panel estándar, la entrada aparecería también en servidores que no
son de Minecraft (donde devolvería 404).

### Cómo aparece el enlace en temas personalizados

Muchos temas no construyen la barra lateral desde `routes.ts`, sino con su propia lista
fija. Para esos casos `WorldManagerGuard` no parchea nada: localiza el grupo de navegación
del tema (`[data-theme-layout-group="server:addons"]`, o el contenedor del enlace a
*Files*), copia las clases de un item vecino e inyecta ahí un `NavLink` real mediante un
portal de React. Así la entrada hereda el estilo del tema y sobrevive a sus
actualizaciones. Un `MutationObserver` acotado a la barra lateral la vuelve a colocar si el
tema repinta el menú.

Si el panel ya dibuja la entrada por su cuenta (caso estándar, vía `routes.ts`), el guard
lo detecta y no inyecta nada, así que nunca sale duplicada.

---

## Si el panel se rompe

El instalador guarda `public/assets`, `public/mix-manifest.json` y `public/build` en
`.world-manager/assets-backup/` **antes** de tocar nada, y revierte todo solo si la
compilación falla. La desinstalación restaura esa copia en vez de recompilar, así que la
vuelta atrás es exacta aunque tu tema no se pueda compilar desde el código.

Si vienes de una instalación anterior a esta protección y el panel sigue roto tras
desinstalar, comprueba primero que los fuentes están limpios:

```bash
grep -rn "world-manager" /var/www/pterodactyl/routes /var/www/pterodactyl/resources/scripts | head
ls /var/www/pterodactyl/app/WorldManager /var/www/pterodactyl/resources/scripts/worldmanager 2>&1
```

Si no sale nada, el addon ya no está y lo que queda roto son los assets compilados:
recompílalos, o reinstala tu tema si trae los suyos ya construidos.

```bash
cd /var/www/pterodactyl && NODE_OPTIONS=--max-old-space-size=4096 yarn build:production
```

Después recarga con **Ctrl+F5** (el navegador cachea el bundle antiguo).

### El error "An error was encountered by the application while rendering this view"

Es el ErrorBoundary de React, y en Pterodactyl **no cubre la barra lateral**: un fallo
pintando el menú tumba toda la vista del servidor. La causa habitual en temas
personalizados es que sus rutas llevan un campo `icon` obligatorio. El parcheador lo
detecta y añade `icon: faGlobe` cuando el tema usa FontAwesome; si usa otra librería de
iconos, aborta y te pide hacerlo a mano en vez de dejar el panel roto.

Para saber qué falla exactamente, abre la consola del navegador (F12) en la página del
servidor: el error real aparece ahí con el nombre del componente.

## Notas de mantenimiento

- **Tras actualizar Pterodactyl**, el panel sobrescribe los archivos parcheados. Ejecuta
  `world-manager update` para volver a aplicarlos.
- La carpeta de trabajo `.world-manager/` dentro de cada servidor guarda los archivos
  subidos y los `.tar.gz` generados; se limpia sola en cada descarga nueva.
- Las acciones quedan registradas en la pestaña *Activity* del servidor como
  `server:world-manager.*`.

## Licencia

MIT.
