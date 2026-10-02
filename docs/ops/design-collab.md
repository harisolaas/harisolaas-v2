# Guía para colaborar en el diseño de harisolaas.com

Te damos la bienvenida 🌱 Esta guía es para vos, que vas a iterar el diseño del sitio usando Claude Code. No hace falta que sepas programar: Claude hace el trabajo técnico y vos guiás el diseño. Lo importante es entender el circuito de trabajo.

## Tranquilidad primero

**No podés romper el sitio en producción.** La rama `main` (la que está publicada en harisolaas.com) está protegida: nadie puede subirle cambios directamente, y ningún cambio tuyo se publica sin que Hari lo revise y apruebe. El peor escenario posible es que un cambio no guste y se descarte. Experimentá con libertad.

## Configuración inicial (una sola vez)

1. Aceptá la invitación al repositorio que te llega por email de GitHub.
2. Instalá [Claude Code](https://claude.com/claude-code) siguiendo las instrucciones de la página.
3. Pedile a Claude que clone el repositorio y prepare el entorno. Podés decirle literalmente:
   > Cloná github.com/harisolaas/harisolaas-v2, instalá las dependencias y levantá el servidor de desarrollo.
4. Cuando el servidor esté corriendo, abrí `http://localhost:3000` en el navegador: ahí ves el sitio con tus cambios en vivo.

## El circuito de trabajo

1. **Contale a Claude qué querés cambiar.** En tus palabras, como se lo contarías a una persona: "quiero que el hero tenga más aire", "probemos otra tipografía en los títulos", "este verde no me convence".
2. **Claude crea una rama** con el prefijo `design/` (por ejemplo `design/hero-espaciado`). Nunca se trabaja directo sobre `main` — Claude ya lo sabe, pero si te propone otra cosa, recordáselo.
3. **Iterá mirando `localhost:3000`.** Pedí ajustes las veces que haga falta hasta que te guste lo que ves.
4. **Cuando haya algo que valga la pena mostrar, pedile a Claude que abra un Pull Request (PR) en modo borrador.** Un PR es una propuesta de cambio: junta todo lo que hiciste en la rama y lo deja listo para revisar. No hace falta que esté perfecto — abrir el PR temprano es la forma de compartir el avance.
5. **Mirá el preview de Vercel.** En cada PR, Vercel publica automáticamente una URL de vista previa (aparece como comentario en el PR). Es el sitio real con tus cambios, ideal para verlo desde el celular o compartir el link.
6. **Cuando la iteración esté lista, marcá el PR como "Ready for review"** (o pedíselo a Claude) y avisale a Hari.
7. **Hari revisa y mergea.** Solamente él puede aprobar y publicar cambios. Si pide ajustes, seguís iterando en la misma rama y el PR se actualiza solo.

## Qué tocar y qué no

- **Tu cancha:** componentes visuales, textos, estilos, colores, imágenes, animaciones.
- **Fuera de alcance:** pagos, base de datos, emails, configuración del servidor. Si un cambio de diseño parece necesitar algo de eso, no pasa nada: Claude lo va a frenar y dejar anotado en el PR para que lo resuelva Hari.

## Dudas

Cualquier cosa que no cierre, preguntale primero a Claude ("¿qué es un PR?", "¿dónde está el texto del hero?") — y si sigue sin cerrar, escribile a Hari por WhatsApp.
