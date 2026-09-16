#INFORME DEL PROYECTO – SESIÓN 21
#SinBachesApp
#Oráculo → Smart Contracts → Blockchain → IA
#Estudiante: Yurandir Loayza Rosas
#Ingeniería de Inteligencia Artificial
#Fecha: 15 de septiembre de 2026


Este proyecto es una simulación web en **PHP puro** de un sistema automatizado para una Ciudad Inteligente. Aplica estrictamente el patrón arquitectónico requerido: **Oráculo → Smart Contracts → Blockchain → IA Generativa**.

## 🏗️ Arquitectura del Proyecto

1. **📡 Oráculo (Simulador):** Un formulario (con apariencia de app móvil) que simula los datos de acelerómetro (vibración) recibidos desde los buses de transporte público, apoyado por un mapa interactivo (Leaflet) de San Sebastián.
2. **⚙️ Smart Contracts (Reglas de Negocio):** Lógica en el backend (`backend.php`) que evalúa los reportes:
   - **Regla 1:** Si una calle acumula 5 o más reportes de baches, se genera un "Ticket de Asfalto" automático.
   - **Regla 2 (Prioridad):** Si la calle reportada es una "Avenida Principal", la prioridad del ticket se establece en "Urgente", de lo contrario es "Normal".
3. **🔗 Blockchain (Historial Inmutable):** Un registro cronológico de todos los eventos del sistema almacenado en `database.json`.
4. **🧠 IA Generativa (Asistente):** Un simulador que redacta un Tuit automático y empático dirigido a los ciudadanos, permitiendo compartirlo directamente por WhatsApp o Facebook.

## 📂 Estructura de Carpetas

```
cazador_de_baches/
├── backend/
│   ├── backend.php        # Lógica del servidor (API)
│   └── database.json      # Base de datos local
├── frontend/
│   ├── index.html         # Interfaz principal
│   ├── css/
│   │   └── style.css      # Estilos personalizados
│   └── js/
│       └── app.js         # Lógica cliente y conexión AJAX
└── README.md
```

## 🚀 Cómo ejecutar el proyecto localmente

Dado que está construido en PHP puro, es muy fácil de correr sin necesidad de instalar XAMPP o configuraciones complejas. Solo necesitas tener PHP instalado en tu computadora.

1. Abre tu terminal o consola de comandos.
2. Navega hasta la carpeta raíz del proyecto (`cazador_de_baches`).
3. Inicia el servidor interno de PHP con el siguiente comando:

   ```bash
   php -S localhost:8000
   ```

4. Abre tu navegador web y visita: [http://localhost:8000/frontend/](http://localhost:8000/frontend/)

## 🎮 Cómo probar el flujo

1. En el panel **1. Oráculo (Celular)**, verás cómo el mapa carga el distrito de San Sebastián. Selecciona una calle y haz clic en "¡DETECTAR IMPACTO!". Observa la animación y cómo se agrega al **Blockchain**.
2. Envía **5 reportes para la misma calle**. Verás que en el quinto reporte, el Smart Contract (Regla 1) genera automáticamente un Ticket de Asfalto en el panel central.
3. Haz clic en el botón **"IA"** en la tabla. El sistema simulará una respuesta que podrás compartir por **WhatsApp** o **Facebook**.
4. Haz clic en el botón de **Check Verde (Solucionar)** para marcar que la cuadrilla reparó el bache.
5. Haz clic en el botón superior verde **"Reporte Mensual"** para visualizar el Dashboard con la cantidad de baches arreglados en el mes.
