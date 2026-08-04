# Brief de diseño final — TypeRush con el sistema visual de Avíspate

**Fecha:** 3 de agosto de 2026  
**Producto a rediseñar:** [JuanFCast/TypeRush](https://github.com/JuanFCast/TypeRush)  
**Referencia principal y fuente de verdad visual:** [JuanFCast/avispate-visual](https://github.com/JuanFCast/avispate-visual)  
**Logo oficial aprobado:** `icon.png`, PNG de 512 × 512 px  
**Nombre de marca obligatorio:** `TypeRush`

## 1. Encargo

Rediseñar TypeRush tomando la interfaz actual de Avíspate como base visual y de experiencia. **Jugar, Ranking, Historial y Perfil deben verse y comportarse como sus equivalentes en Avíspate**, con la misma composición, jerarquía, espaciado, navegación, anatomía de tarjetas y tratamiento responsive.

La estructura del producto, la navegación, la jerarquía de las pantallas, el comportamiento responsive, los estados de acceso y pago, la forma de presentar premios, el historial y el perfil deben seguir el mismo sistema de Avíspate. Las únicas diferencias intencionales deben ser:

- El juego: mecanografía de 45 segundos en TypeRush frente al juego de símbolos de Avíspate.
- La identidad: **TypeRush**, el nuevo logo oficial del rayo y su lenguaje visual de velocidad tranquila.
- La paleta derivada del logo y la tipografía **Sora** propias de TypeRush.
- Las métricas y controles que pertenecen al juego de mecanografía.
- Los datos económicos reales de TypeRush: modalidades, tokens, entradas, pozos y horarios obtenidos de sus fuentes autoritativas.

La regla que debe guiar todas las decisiones es:

> Si dos elementos cumplen la misma función en ambas apps, deben ocupar el mismo lugar, tener la misma jerarquía, tamaño, espaciado y comportamiento. Se cambia la abeja por el rayo oficial y se adapta el contenido al juego de mecanografía; no se rediseña desde cero una segunda arquitectura para TypeRush.

## 2. Resultado esperado

Al abrir ambas aplicaciones, una persona debe reconocer inmediatamente que pertenecen a la misma familia de productos, aunque nunca pueda confundir una con la otra.

TypeRush no debe sentirse como una landing page de marketing. Debe abrir directamente como un juego listo para usar, igual que Avíspate: marca compacta, reto del día, premio, acción principal, ranking resumido y navegación estable.

### Qué significa “igual que Avíspate”

- Misma arquitectura de información y misma composición visual de las pantallas equivalentes.
- Mismos destinos principales: **Jugar, Historial y Perfil**.
- Mismo orden de prioridad dentro de cada pantalla.
- Mismo patrón de tarjetas, radios, sombras, densidad, estados, espaciado y comportamiento responsive.
- Mismo principio de una sola acción principal visible.
- Mismo uso contextual del acceso, la wallet y el pago.
- Mismo criterio para ocultar distracciones durante una partida.
- Misma ubicación conceptual del ranking: accesible desde Jugar y desde Historial, pero sin una cuarta pestaña principal.
- Si este documento deja una medida visual abierta, se debe inspeccionar el componente equivalente vigente en `avispate-visual` y replicar su solución; no improvisar una alternativa.

### Paridad obligatoria por pantalla

| Pantalla | Conservar de Avíspate | Adaptar a TypeRush |
| --- | --- | --- |
| **Jugar** | Cabecera, tarjeta principal, orden premio/configuración/CTA, tutorial, top 3, espacios, estados y navegación inferior | Reto de mecanografía, 45 segundos, modalidad, pasaje, entrada y premio reales |
| **Ranking** | Encabezado, filtros, filas, jerarquía de posiciones, resaltado del usuario, carga, vacío y responsive | WPM, precisión, puntaje, idioma y reto de TypeRush |
| **Historial** | Encabezado, filtros, lista vertical, tarjetas de ganador, badges de estado y enlace verificable | Ganador, modalidad, WPM, premio, token y transacción reales de TypeRush |
| **Perfil** | Composición del avatar, identidad, cuadrícula de estadísticas, premios recientes, wallet, ajustes y enlaces | Rayo, alias, métricas de mecanografía, saldos y datos reales de TypeRush |

### Qué no se copia

- No copiar el nombre, la abeja, textos, emojis, amarillo principal, tipografías ni recursos de marca de Avíspate.
- No copiar la mecánica de cartas o sus métricas.
- No copiar valores económicos de Avíspate.
- No crear funcionalidades que TypeRush todavía no tenga solo para llenar un espacio.
- No tocar contratos, liquidación, pagos, base de datos o reglas del juego como parte del rediseño visual.

La paridad de layout sí es intencional. Lo que debe ser diferente es la marca, el contenido del juego, las métricas y los datos; no la calidad ni la estructura de la experiencia.

## 3. Diagnóstico de la versión actual

TypeRush ya tiene rutas y componentes para **Jugar, Historial y Perfil**, pero su pantalla inicial sigue una lógica distinta a Avíspate. Actualmente `ModeHome.tsx` funciona como una portada de marketing con distintivos, un titular grande, una demostración de la carrera y un CTA. Avíspate, en cambio, entra directamente a un lobby de producto donde el reto diario concentra premio, configuración, entrada, CTA y top 3.

El rediseño debe cerrar esa diferencia:

- Sustituir la portada de marketing por un lobby de juego.
- Quitar del inicio la información de sesión que compita con el reto. La identidad y la wallet deben vivir en Perfil y aparecer en Jugar solo cuando el CTA necesite pedir acceso, alias o confirmación.
- Unificar las tres pantallas bajo un solo shell visual.
- Evitar que TypeRush tenga una navegación móvil y otra experiencia distinta en escritorio. Debe conservar la misma arquitectura en todos los tamaños.

## 4. Arquitectura de información

| Destino | Ruta | Función | Acceso |
| --- | --- | --- | --- |
| Jugar | `/` | Reto diario, premio, modalidad, entrada, CTA y top 3 | Pestaña principal |
| Historial | `/historial` | Ganadores de rondas cerradas y pagos realizados | Pestaña principal |
| Perfil | `/perfil` | Identidad, estadísticas, premios, wallet y ajustes | Pestaña principal |
| Ranking | `/ranking` | Clasificación completa de la ronda actual | Enlace desde Jugar e Historial |
| Estadísticas | `/stats` | Métricas públicas del producto | Enlace secundario |
| Términos | `/terminos` | Información legal | Enlace desde Perfil |
| Privacidad | `/privacidad` | Información legal | Enlace desde Perfil |

No añadir una pestaña independiente de Ranking. En el momento en que más importa, el ranking debe verse resumido dentro de Jugar; el historial conserva el enlace a la clasificación completa.

## 5. Shell global

### Cabecera

La cabecera debe seguir el patrón de Avíspate:

- Centro: isotipo oficial del rayo + nombre **TypeRush**.
- Derecha: control de sonido.
- Izquierda: espacio simétrico para que la marca permanezca realmente centrada.
- La wallet no debe convertirse en el protagonista de la cabecera.
- El selector de idioma puede vivir dentro del contenido o en Perfil. Si se conserva una versión compacta en la cabecera, no debe desplazar la marca ni cambiar la composición entre rutas.

El nombre siempre se escribe **TypeRush**, unido, con `T` y `R` mayúsculas. No usar `Typerush`, `TYPE RUSH`, `Type Rush` ni `typeRush`. El wordmark usa **Sora ExtraBold 800**: `Type` en tinta verde oscura y `Rush` en verde eléctrico. No inclinar las letras ni añadir líneas de velocidad; el rayo ya comunica rapidez.

El rayo debe ser el mismo recurso en la cabecera, el avatar, la navegación y los estados vacíos. No usar una mezcla de teclado, rayo, emoji `⚡` y otros símbolos como sustitutos de marca. Para espacios grandes se usa el PNG oficial completo; para controles pequeños se crea un componente `TypeRushBolt` con la misma silueta del rayo del logo.

### Navegación inferior

Tres destinos y en este orden:

1. **Rayo · Jugar**
2. **Trofeo · Historial**
3. **Usuario · Perfil**

Requisitos:

- Fija en la parte inferior y centrada respecto al contenido.
- Respeta `env(safe-area-inset-bottom)`.
- Mismo ancho al cambiar de pantalla; no debe saltar ni encogerse.
- Área táctil mínima de 44 × 44 px.
- El destino activo usa el verde suave de TypeRush y el verde profundo para texto o icono.
- Debe mantenerse también en escritorio como navegación compacta de la aplicación, en lugar de convertir la cabecera en una navegación diferente.
- Se oculta durante la cuenta regresiva y la carrera para evitar distracciones.
- Vuelve a aparecer en el lobby y en los resultados.

### Anchos y composición

Tomar el sistema de Avíspate como referencia:

- Móvil: ancho completo menos 16 px por lado.
- Tablet vertical: columna más aireada, aproximadamente hasta 680 px.
- Escritorio: área de aplicación de hasta 920 px.
- Historial: lista vertical centrada, aproximadamente hasta 720 px.
- Perfil: una columna continua de aproximadamente 560 px; encabezado y tarjetas comparten el mismo eje.

En escritorio no se debe mostrar una versión de teléfono diminuta en el centro. Las tarjetas deben crecer, redistribuir su contenido internamente y aprovechar el ancho disponible sin convertirse en líneas de texto excesivamente largas.

## 6. Identidad visual aprobada

### Logo oficial

Usar `icon.png` como activo maestro. Debe incorporarse al proyecto con un nombre estable, por ejemplo `public/brand/typerush-icon.png`, sin redibujarlo, recolorearlo, deformarlo ni aplicarle una máscara circular.

- Conservar la base verde oscura, la superficie blanca y el rayo verde eléctrico.
- Mantener su relación de aspecto 1:1 y usar `object-fit: contain`.
- Usarlo como app icon, favicon/PWA, avatar de marca, cabecera y estados vacíos importantes.
- En tamaños pequeños no mostrar el pedestal completo si pierde legibilidad: usar el componente `TypeRushBolt` derivado de la misma silueta, nunca un emoji genérico.
- Si Avíspate muestra su abeja como personaje o recurso de marca, TypeRush muestra este rayo o su versión simplificada equivalente, en la misma ubicación y escala visual.

### Tipografía

La tipografía principal de identidad e interfaz es **Sora**. Su geometría se relaciona con los ángulos del rayo y mantiene un tono tecnológico, amable y legible.

| Uso | Familia | Peso recomendado | Regla |
| --- | --- | --- | --- |
| Wordmark `TypeRush` | Sora | 800 | `Type` oscuro + `Rush` verde; tracking aproximado `-0.035em` |
| Títulos de pantalla | Sora | 700–800 | Cortos, compactos y sin mayúsculas sostenidas |
| Botones, filtros y navegación | Sora | 600–700 | Claros y estables entre estados |
| Texto de interfaz | Sora | 400–500 | Mínimo 16 px en inputs móviles |
| Pasaje de la carrera | JetBrains Mono | 500 | Monoespaciada para distinguir cada carácter |
| Tiempo, WPM y precisión | JetBrains Mono | 600–700 | Números tabulares cuando sea posible |

No usar Fredoka, Nunito ni Space Grotesk. JetBrains Mono no es la tipografía de marca: se limita al juego y a datos donde la alineación numérica aporta valor.

### Paleta derivada del logo

| Sistema de Avíspate | Equivalente en TypeRush |
| --- | --- |
| Abeja / `logo-avispate.png` | Rayo oficial de TypeRush |
| Avíspate | TypeRush |
| Amarillo principal `#FFC20E` | Verde eléctrico `#02CF83` |
| Amarillo presionado `#D9A300` | Verde profundo `#008558` |
| Amarillo suave `#FFF3CD` | Verde suave `#DDF7EC` |
| Cian secundario `#00C7D6` | Amarillo Celo `#FCFF52`; para trazos pequeños usar `#D4A900` |
| Fondo cálido `#FFFDF6` | Fondo TypeRush `#F2F5F3` |
| Tinta `#0D0D0F` | Tinta del logo `#152721` |
| Fredoka + Nunito | Sora + JetBrains Mono solo en carrera/datos |

Tokens complementarios de TypeRush:

- Verde eléctrico de marca: `#02CF83`.
- Verde de acción accesible: `#008558`.
- Verde base oscuro del icono: `#11231D`.
- Superficie tenue: `#E9EFEB`.
- Tarjetas: `#FFFFFF`.
- Líneas tomadas del icono: `#D2E5DD`.
- Texto secundario: `#616C68`.
- Error: `#D43F54`.
- Advertencia: `#9A6700`.

Reglas de contraste:

- El verde eléctrico `#02CF83` sirve como marca, decoración, foco o texto grande sobre fondo oscuro.
- Para botones con texto blanco usar `#008558`, que sí alcanza contraste AA.
- El amarillo Celo claro solo se usa como fondo con texto oscuro; nunca como texto pequeño sobre blanco.
- Ningún estado depende únicamente del color: acompañar con texto, icono o forma.

### Personalidad

TypeRush debe sentirse rápido, claro y moderno, pero no agresivo ni parecido a una plataforma de trading. El rayo representa agilidad y concentración. Las animaciones pueden ser ágiles, cortas y satisfactorias; no deben producir ruido constante.

## 7. Pantalla Jugar

### Cambio principal

Eliminar la lógica de landing page de la portada actual. No abrir con tres badges, un titular publicitario gigante y una demo separada. La persona ya entró al producto: debe encontrar el reto listo para jugar.

La demostración fiel de la carrera se traslada a **Cómo jugar**, donde sí ayuda a aprender.

La composición debe partir directamente de la pantalla Jugar vigente de Avíspate. No basta con “inspirarse”: hay que conservar su ritmo vertical, proporciones, ubicación del CTA, resumen del ranking, cabecera y navegación, sustituyendo las piezas de contenido por las de TypeRush.

### Tarjeta del reto diario

La tarjeta principal de TypeRush es el equivalente de `DailyChallengeCard` de Avíspate. Debe ser autosuficiente y contener, en este orden lógico:

1. Etiqueta **Reto diario** o **Carrera diaria**.
2. Título corto del reto de mecanografía.
3. Premio real de la ronda, leído desde la fuente actual de TypeRush.
4. Hora o cuenta regresiva hasta el cierre.
5. Modalidad del texto: Español o English.
6. Selector de reto disponible dentro de esa modalidad.
7. Estado de intento gratis o precio real de la siguiente entrada.
8. Un único CTA principal.
9. Enlace **Cómo jugar**.
10. Top 3 de la ronda y enlace **Ver ranking completo**.

En móvil todo se apila dentro de una sola tarjeta. En escritorio la misma tarjeta puede abrirse en dos columnas: configuración y CTA a la izquierda; top 3 a la derecha. No se debe crear una pantalla distinta según el dispositivo.

### Modalidades y retos

Mantener los datos reales que ya existen en TypeRush:

- Español: Motivación, Noticias y Cripto.
- English: Motivation y Daily.

La modalidad define el idioma del texto que se escribe, el ranking y el pozo. El idioma de la interfaz sigue siendo una preferencia separada aunque, desde el inicio, el selector pueda cambiar ambos por comodidad. Nunca traducir automáticamente el pasaje que se debe teclear.

Los retos pueden representarse como opciones compactas dentro de la tarjeta. No necesitan una portada intermedia que haga sentir que la persona salió del lobby.

### Estados del CTA

El botón conserva posición y tamaño; cambia texto y estado:

| Estado | Mensaje o acción esperada |
| --- | --- |
| Resolviendo sesión | Comprobando… |
| Sin acceso | Entrar para jugar |
| Sin alias | Elegir nombre |
| Intento gratis disponible | Jugar gratis |
| Intento gratis usado | Jugar por [precio real] |
| Wallet esperando | Confirma en tu wallet… |
| Transacción enviada | Confirmando en Celo… |
| Cobro confirmado | Registrando jugada… |
| Lista | Empezar |
| Error recuperable | Reintentar, sin perder el contexto |

No mostrar “Jugar gratis” mientras todavía se consulta si el intento ya fue usado. No usar un overlay genérico si el avance cabe dentro del botón. Después de un cobro confirmado, nunca invitar a pagar otra vez por un fallo de registro.

### Ranking resumido

- Mostrar las tres primeras posiciones de la modalidad elegida.
- Cada fila: posición, alias, WPM y, si ayuda a desempatar, precisión o puntaje.
- Resaltar con discreción la posición del usuario si aparece.
- Añadir **Ver ranking completo**.
- El ranking completo conserva filtros por modalidad y reto, pero no entra en la navegación principal.

### Ranking completo

La ruta `/ranking` debe reproducir el patrón visual del ranking de Avíspate: mismo encabezado, filtros compactos, lista de posiciones, jerarquía del podio, resaltado del usuario, skeleton, estado vacío y comportamiento móvil/escritorio.

Cada fila de TypeRush muestra como mínimo posición, alias y WPM. Precisión o puntaje se añaden solo cuando la fuente de datos real los ofrece y ayudan a explicar el desempate. Los filtros se adaptan a modalidad y reto. **Ranking se ve completo como en Avíspate, pero sigue siendo un destino secundario enlazado desde Jugar e Historial; no se añade una cuarta pestaña inferior.**

### Segunda tarjeta

Avíspate muestra Arena porque es una función real de ese producto. TypeRush no debe inventar una Arena o un multijugador solo para copiar el espacio. Si existe una segunda experiencia real —por ejemplo, práctica sin ranking— puede ocupar una tarjeta hermana con el mismo sistema visual. Si no existe, el lobby queda concentrado en el reto diario.

## 8. Tutorial “Cómo jugar”

Debe abrirse automáticamente la primera vez y poder reabrirse desde Jugar.

Contenido sugerido:

1. Elige el idioma y el reto.
2. Tienes 45 segundos.
3. Escribe exactamente el texto mostrado.
4. Los caracteres correctos, los errores y las correcciones se distinguen visualmente.
5. Tu WPM, precisión y progreso se calculan en vivo.
6. El mejor resultado válido entra al ranking diario.

La demostración debe usar el componente o una representación fiel del campo real de escritura. No marcarla como “DEMO” si ya está dentro de un tutorial claramente identificado.

## 9. Cuenta regresiva, carrera y resultado

### Cuenta regresiva

- Pantalla limpia con 3, 2, 1 y “¡YA!”.
- Rayo como recurso de energía o transición, sin convertirlo en una animación pesada.
- Sin cabecera ni navegación inferior.
- El teclado móvil debe permanecer preparado durante la cuenta regresiva.

### Carrera

Esta es la parte que debe seguir siendo inequívocamente TypeRush:

- Cronómetro de 45 segundos.
- Barra de tiempo o progreso.
- Pista/rayo como indicador visual secundario.
- Pasaje grande, legible y con fuente monoespaciada.
- Caracteres pendientes, correctos, equivocados y corregidos claramente diferenciados.
- Métricas en vivo: WPM, precisión, errores y correcciones.
- Sin navegación, promoción, saldo ni wallet visibles.

Prioridad móvil: el campo de escritura debe conservar suficiente altura cuando aparece el teclado. No permitir que el WebView desplace el contenido bajo el notch ni que el texto activo quede escondido.

### Resultado

Usar la jerarquía del panel de resultado de Avíspate, adaptada:

- Métrica hero: WPM.
- Secundarias: precisión, errores, correcciones y puntaje.
- Nuevo récord con celebración breve.
- CTA principal: volver a los retos o jugar otra vez, según el estado real de la entrada.
- Acción secundaria: volver al inicio.
- Bloqueo breve de botones para que el último tecleo no active una acción accidentalmente.
- La navegación puede volver a aparecer una vez termina la partida.

## 10. Historial

Historial debe tener la misma función que en Avíspate: mostrar públicamente los ganadores de rondas ya cerradas y comprobar que el premio se pagó. Los premios personales recientes viven en Perfil; no duplicar la misma lista completa en dos destinos.

Visualmente debe replicar el Historial vigente de Avíspate: mismo ancho de lectura, encabezado, espaciado, filtros, estructura vertical de tarjetas, badges y estados. Solo cambian los campos propios del juego y la paleta TypeRush.

### Encabezado

- Título **Historial**.
- Explicación breve.
- Enlaces a **Ranking de hoy** y **Estadísticas en vivo**.

### Filtros propios de TypeRush

- Modalidad: todas, Español, English.
- Token: todos, USDT, COPm, únicamente si ambos siguen activos en la versión desplegada.

### Tarjeta de una ronda

- Fecha o cierre de la ronda.
- Alias del ganador.
- Modalidad y reto, si corresponde.
- WPM y precisión; puntaje solo si aporta contexto.
- Premio pagado en cada token.
- Estado: Pagado, Pendiente, Falló, Cierre en curso o Acumulado.
- Enlace a Celoscan cuando exista transacción.

El estado verde se reserva para dinero ya entregado. Pendiente usa ámbar, fallo usa rojo y rollover/acumulado usa un estado neutro. Las tarjetas forman una sola lista vertical centrada incluso en escritorio, para que cada ganador se lea como un registro completo y no como una cuadrícula apretada.

## 11. Perfil

El perfil debe conservar el orden vertical y la continuidad visual de Avíspate.

La referencia es directa, no conceptual: avatar, alias, wallet, cuadrícula de estadísticas, bloque **Tus premios**, tarjetas de saldo, ajustes y enlaces deben conservar la misma composición y orden del Perfil vigente de Avíspate. Se reemplazan la abeja y las métricas de cartas por el rayo y las métricas de mecanografía.

### Sin sesión

- Avatar con el rayo de TypeRush, no una abeja ni un teclado genérico.
- Título **Tu perfil**.
- Explicación corta.
- CTA para volver a Jugar e iniciar sesión cuando sea necesario.
- Navegación inferior visible.

### Con sesión

Orden recomendado:

1. Avatar del rayo.
2. Alias grande y editable.
3. Wallet activa abreviada y opción de copiar.
4. Estadísticas.
5. Premios recientes.
6. Wallet y saldos.
7. Ajustes y enlaces.

### Estadísticas adaptadas

- Partidas jugadas.
- Victorias.
- Mejor WPM.
- Mejor precisión.
- Posición actual, si está disponible.
- Total ganado por token.

Usar tarjetas con el mismo tamaño, radio y alineación. En móvil pueden ser dos columnas; en escritorio pueden distribuirse en una fila más ancha sin romper la columna principal.

### Tus premios

- Mostrar solo los tres más recientes.
- Cada fila: trofeo, monto, token, modalidad, fecha, estado y enlace a Celoscan.
- Acción **Ver historial completo**.
- No usar “Pagado” si todavía no existe una transacción confirmada.

### Wallet y ajustes

- Dirección copiable.
- Saldos y acciones disponibles según la wallet real.
- Idioma.
- Estadísticas en vivo.
- Soporte.
- Cerrar sesión.
- Términos y privacidad.

La lógica de wallet embebida, MiniPay y wallet externa no cambia. El diseño debe representar correctamente cualquiera de las tres.

## 12. Estados transversales

Cada pantalla debe diseñarse y probarse en estos estados:

- Cargando: skeletons estables; no texto que después cambie el ancho de toda la pantalla.
- Sin datos: rayo o icono contextual, explicación y siguiente acción útil.
- Error de red: mensaje dentro de la tarjeta afectada y botón Reintentar.
- Sin sesión: acceso contextual, no muro genérico al abrir la app.
- Wallet bloqueada: explicar que hay que desbloquearla y ofrecer volver a intentar; no mostrar un error técnico crudo.
- Saldo insuficiente: cantidad faltante, token y acción de recarga cuando exista.
- Transacción rechazada: volver al mismo estado sin asumir que se cobró.
- Transacción confirmada pero registro pendiente: indicar que no debe volver a pagar y reintentar automáticamente.
- Ronda sin jugadores: estado acumulado, no ganador ficticio.
- Movimiento reducido: sin animaciones indispensables para entender la interfaz.

## 13. Responsive y accesibilidad

Validar al menos estos anchos: 320, 375, 390, 430, 768, 1024 y 1440 px.

### Móvil

- Es la prioridad.
- Una columna, CTA antes de contenido secundario y sin scroll horizontal.
- Barra inferior fuera de la home bar del dispositivo.
- Inputs de 16 px o más para evitar zoom automático en iOS.
- Controles de al menos 44 px.
- Probar con teclado abierto en iPhone/MiniPay.

### Escritorio

- Usar el ancho disponible; no ampliar solo los márgenes.
- La portada puede distribuir el interior de la tarjeta en dos columnas.
- Las tarjetas y la tipografía deben crecer de forma controlada.
- Historial y Perfil siguen siendo columnas legibles, no mosaicos de tarjetas pequeñas.

### Accesibilidad

- Contraste WCAG AA para texto normal.
- Foco visible con teclado.
- `aria-current` en navegación.
- Labels y mensajes de estado para lectores de pantalla.
- No bloquear el zoom del usuario.
- Respetar `prefers-reduced-motion`.
- Español e inglés completos, sin cadenas mezcladas ni traducción automática del pasaje.

## 14. Límites técnicos del rediseño

Este trabajo es de arquitectura visual y UX. Debe preservar:

- Lógica del juego de 45 segundos.
- Cálculo de WPM, precisión, errores, correcciones y puntaje.
- Anti-cheat y emisión/entrega de runs.
- Elegibilidad del intento gratis.
- Flujos de Privy, RainbowKit, MiniPay y wallets externas.
- APIs, Supabase, outbox e idempotencia.
- Contratos, direcciones, tokens, precios, pozos y cierre diario.
- Internacionalización y pasajes canónicos.

No desplegar contratos, no cambiar fondos reales, no migrar V2 a V3 y no modificar variables de producción como parte de este brief. El flujo V3 debe cablearse y verificarse en una tarea de ingeniería separada antes de cualquier activación; el rediseño no puede ocultar ni resolver visualmente esa dependencia.

## 15. Correspondencia de componentes

| Referencia Avíspate | Destino TypeRush |
| --- | --- |
| `GameShell` en fase setup | Orquestador de `app/page.tsx` en estado idle |
| `HomeLobby` | Sustituir la portada actual de `ModeHome` |
| `DailyChallengeCard` | Tarjeta única del reto diario de mecanografía |
| `LeaderboardPreview` | Top 3 de TypeRush por modalidad/reto |
| `ProfileBottomNav` | `BottomNav` con ⚡, 🏆 y 👤 |
| `HowToPlay` | Tutorial fiel del campo de escritura |
| `GameHUD` + cartas | `RaceScreen`, `Track` y `TypeField` |
| `ResultsPanel` | `ResultScreen` |
| `WinnersHistory` | Historial de cierres y pagos de TypeRush |
| `ProfileHeader` | Avatar de rayo, alias y wallet |
| `ProfileStats` | Partidas, victorias, WPM, precisión y premios |
| `WonPrizes` | Tres premios recientes y enlace al historial |
| `WalletCard` / `WalletTokens` | Wallet activa y tokens reales de TypeRush |

La correspondencia es conceptual. No copiar archivos completos si eso rompe la lógica o los estilos de TypeRush; extraer el patrón y construirlo con sus componentes y tokens.

## 16. Orden de implementación recomendado

1. Definir tokens de TypeRush y el shell único.
2. Igualar cabecera y navegación inferior.
3. Reemplazar la landing por el lobby y la tarjeta del reto diario.
4. Integrar top 3 y acceso al ranking completo.
5. Adaptar tutorial, cuenta regresiva y resultados al mismo sistema.
6. Alinear Historial con el patrón de ganadores y pagos.
7. Alinear Perfil con el orden y ancho de Avíspate.
8. Completar estados de carga, vacío, error, wallet y pago.
9. Verificar responsive, accesibilidad, MiniPay e idiomas.

Hacer el trabajo por capas reduce el riesgo: primero composición y estilos; después integrar cada estado con las fuentes de datos existentes. No mezclar el rediseño con cambios de contrato o economía.

## 17. Criterios de aceptación

El rediseño se considera terminado cuando:

- [ ] TypeRush abre como aplicación de juego y no como landing page.
- [ ] Jugar, Ranking, Historial y Perfil conservan la composición y comportamiento de sus equivalentes vigentes en Avíspate.
- [ ] Jugar, Historial y Perfil comparten el mismo shell, ancho, espaciado y navegación.
- [ ] La navegación inferior muestra **Rayo · Jugar, Trofeo · Historial y Usuario · Perfil**, sin una cuarta pestaña.
- [ ] El nombre se muestra siempre exactamente como **TypeRush**.
- [ ] La identidad usa Sora; JetBrains Mono queda limitada al pasaje y a métricas de carrera.
- [ ] No queda ninguna abeja, emoji de rayo genérico, amarillo principal de Avíspate, Fredoka, Nunito, Space Grotesk ni texto “Avíspate”.
- [ ] El rayo aparece de forma consistente en todos los lugares donde Avíspate usa su abeja.
- [ ] El activo `icon.png` se conserva sin deformaciones, recoloreados ni máscaras arbitrarias.
- [ ] La portada presenta premio real, cierre, modalidad, reto, entrada, CTA y top 3 sin una pantalla de marketing previa.
- [ ] El ranking completo existe como destino secundario, no como cuarta pestaña.
- [ ] Durante la cuenta regresiva y la carrera desaparecen cabecera y navegación.
- [ ] Historial muestra cierres y pagos con estados honestos y enlaces verificables.
- [ ] Perfil muestra identidad, estadísticas, premios recientes, wallet y ajustes en una sola columna coherente.
- [ ] Ningún mensaje promete intento gratis, pago o premio antes de conocer el estado real.
- [ ] Una transacción confirmada nunca conduce a un segundo cobro por un error de registro.
- [ ] La interfaz funciona en 320–1440 px y aprovecha el escritorio sin encoger las tarjetas.
- [ ] El teclado móvil no tapa el texto activo ni desplaza la cabecera bajo el notch.
- [ ] Español e inglés funcionan sin traducir los pasajes canónicos.
- [ ] Contraste, foco, áreas táctiles, safe areas y movimiento reducido están verificados.
- [ ] `npm run build`, pruebas unitarias y pruebas e2e existentes pasan sin regresiones.
- [ ] Se tomaron capturas comparativas de Jugar, Historial y Perfil en móvil y escritorio para revisar la paridad con Avíspate.

## 18. Instrucción corta para ejecutar el brief

> Rediseña TypeRush usando la interfaz vigente de `avispate-visual` como fuente de verdad: Jugar, Ranking, Historial y Perfil deben conservar su composición, jerarquía, navegación, tarjetas, estados, espaciado y responsive. Sustituye la abeja por el logo oficial `icon.png` o por su rayo simplificado, usa siempre el nombre **TypeRush**, aplica **Sora** como tipografía de identidad y reserva JetBrains Mono para la carrera y sus métricas. Conserva solo Jugar, Historial y Perfil en la barra inferior; Ranking se abre desde Jugar e Historial. Usa TypeRush como fuente de verdad para juego, datos, contratos y pagos. No cambies lógica, contratos, dinero real ni variables de producción. Valida móvil, escritorio, MiniPay, accesibilidad e idiomas antes de considerar el trabajo terminado.

## 19. Archivos de referencia prioritarios

### Avíspate

- [`components/GameShell.tsx`](https://github.com/JuanFCast/avispate-visual/blob/main/components/GameShell.tsx)
- [`components/lobby/HomeLobby.tsx`](https://github.com/JuanFCast/avispate-visual/blob/main/components/lobby/HomeLobby.tsx)
- [`components/profile/ProfileBottomNav.tsx`](https://github.com/JuanFCast/avispate-visual/blob/main/components/profile/ProfileBottomNav.tsx)
- [`app/historial/page.tsx`](https://github.com/JuanFCast/avispate-visual/blob/main/app/historial/page.tsx)
- [`app/perfil/page.tsx`](https://github.com/JuanFCast/avispate-visual/blob/main/app/perfil/page.tsx)
- [`app/globals.css`](https://github.com/JuanFCast/avispate-visual/blob/main/app/globals.css)

### TypeRush

- [`app/page.tsx`](https://github.com/JuanFCast/TypeRush/blob/main/app/page.tsx)
- [`components/AppShell.tsx`](https://github.com/JuanFCast/TypeRush/blob/main/components/AppShell.tsx)
- [`components/BottomNav.tsx`](https://github.com/JuanFCast/TypeRush/blob/main/components/BottomNav.tsx)
- [`components/ModeHome.tsx`](https://github.com/JuanFCast/TypeRush/blob/main/components/ModeHome.tsx)
- [`components/ChallengeLobby.tsx`](https://github.com/JuanFCast/TypeRush/blob/main/components/ChallengeLobby.tsx)
- [`components/RaceScreen.tsx`](https://github.com/JuanFCast/TypeRush/blob/main/components/RaceScreen.tsx)
- [`components/ResultScreen.tsx`](https://github.com/JuanFCast/TypeRush/blob/main/components/ResultScreen.tsx)
- [`app/historial/page.tsx`](https://github.com/JuanFCast/TypeRush/blob/main/app/historial/page.tsx)
- [`app/perfil/page.tsx`](https://github.com/JuanFCast/TypeRush/blob/main/app/perfil/page.tsx)
- [`app/globals.css`](https://github.com/JuanFCast/TypeRush/blob/main/app/globals.css)
