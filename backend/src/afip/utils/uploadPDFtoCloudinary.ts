import cloudinary from "cloudinary";
import fs from "fs";

// 🔧 Configuración de Cloudinary
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * 📤 Sube un PDF generado localmente a Cloudinary y devuelve un link descargable
 * @param filePath Ruta local del archivo (ej: ./factura-0001.pdf)
 * @returns URL segura y directa para abrir o descargar el PDF
 */
export async function uploadPDFtoCloudinary(filePath: string): Promise<string> {
  try {
    const res = await cloudinary.v2.uploader.upload(filePath, {
      folder: "afip_pdfs",
      resource_type: "auto", // ✅ público y autodetectado
      use_filename: true,
      unique_filename: false,
      access_mode: "public",
    });

    fs.unlinkSync(filePath);

    console.log("✅ PDF subido y link listo:", res.secure_url);
    return res.secure_url; // 👈 se puede abrir directo
  } catch (err) {
    console.error("❌ Error al subir PDF a Cloudinary:", err);
    throw err;
  }
}
