-- CreateTable: ProductComponent
-- Define la composición (receta) de productos compuestos/promos
-- Ejemplo: "Promo Fernet+Coca" contiene 1x Fernet + 1x Coca-Cola

CREATE TABLE "ProductComponent" (
    "id"          TEXT NOT NULL,
    "compositeId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "quantity"    INTEGER NOT NULL,

    CONSTRAINT "ProductComponent_pkey" PRIMARY KEY ("id")
);

-- UniqueConstraint: un componente solo puede aparecer una vez por producto compuesto
CREATE UNIQUE INDEX "ProductComponent_compositeId_componentId_key"
    ON "ProductComponent"("compositeId", "componentId");

-- AddForeignKey: el producto compuesto (padre)
ALTER TABLE "ProductComponent"
    ADD CONSTRAINT "ProductComponent_compositeId_fkey"
    FOREIGN KEY ("compositeId") REFERENCES "Product"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: el componente (hijo)
ALTER TABLE "ProductComponent"
    ADD CONSTRAINT "ProductComponent_componentId_fkey"
    FOREIGN KEY ("componentId") REFERENCES "Product"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
