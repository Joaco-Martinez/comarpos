import swaggerJSDoc from "swagger-jsdoc";
import { serve, setup } from "swagger-ui-express";
import { Express } from "express";


const options: swaggerJSDoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "ComarPOS API",
      version: "1.0.0",
      description: "Documentación de la API para el sistema Von König",
    },
    servers: [
        {
    url: "/",
    description: "Mismo host donde corre Swagger",
  },
    ],
  },
  apis: ["./src/docs/*.yaml"],
};


const swaggerSpec = swaggerJSDoc(options);

export function swaggerDocs(app: Express) {
  app.use("/api", serve, setup(swaggerSpec));
  console.log("📖 Swagger docs disponible en http://localhost:4000/api");
}