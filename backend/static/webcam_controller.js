import { Controller } from "https://unpkg.com/@hotwired/stimulus/dist/stimulus.js"

export default class extends Controller {
    // Definimos los "targets" para acceder a los elementos del HTML fácilmente
    static targets = [ "video" ]

    connect() {
        console.log("¡Controlador de Stimulus para Webcam conectado con éxito!")
        this.stream = null
    }

    async encender() {
        // Verificamos si el navegador soporta el acceso a la cámara
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
                // Solicitamos acceso únicamente al video
                this.stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { width: 640, height: 480 } 
                })
                
                // Asignamos el flujo de la cámara al elemento <video>
                this.videoTarget.srcObject = this.stream
                console.log("Cámara encendida")
            } catch (error) {
                console.error("Error al acceder a la cámara web:", error)
                alert("No se pudo acceder a la cámara. Revisa los permisos de tu navegador.")
            }
        }
    }

    apagar() {
        if (this.stream) {
            // Detenemos cada pista de video para apagar físicamente el hardware de la cámara
            this.stream.getTracks().forEach(track => track.stop())
            this.videoTarget.srcObject = null
            console.log("Cámara apagada")
        }
    }

    disconnect() {
        // Aseguramos apagar la cámara si el usuario cambia de página
        this.apagar()
    }
}
