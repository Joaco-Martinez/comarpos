# Patch backend ComarPOS / ComarPOS

Archivos incluidos:

- sale.service.ts
- finance.service.ts
- client.service.ts
- client.controller.ts
- client.routes.ts
- client.yaml
- app.ts
- productStats.service.ts
- alert.service.ts

Cambios principales:

1. Venta con cuenta corriente:
   - `paymentMethod: CUENTA_CORRIENTE` genera deuda.
   - Pagos parciales generan deuda por la diferencia.
   - `Sale.isAccountSale` y `Sale.accountDebtAmount` quedan sincronizados.
   - `Client.currentBalance` se actualiza.
   - Se crea `AccountMovement` tipo `DEBT`.

2. Cancelación de venta:
   - Devuelve stock.
   - Si la venta tenía deuda, revierte el saldo del cliente.
   - Crea `AccountMovement` tipo `CREDIT_NOTE`.
   - Evita doble reversión si la venta ya está cancelada.

3. updatePayments:
   - Permite pagos parciales.
   - Recalcula deuda real.
   - Ajusta `Client.currentBalance` con `ADJUSTMENT_POSITIVE` o `ADJUSTMENT_NEGATIVE`.
   - No permite editar pagos de ventas canceladas.

4. Finance:
   - `registerIncomeFromSale` ya no duplica ingresos.
   - Una venta 100% cuenta corriente no entra como ingreso hasta que se cobre.
   - Ventas parciales registran ingreso solo por lo efectivamente pagado.

5. Clientes:
   - Incluye `currentBalance`, `creditLimit`, `isAccountEnabled`.
   - No permite borrar clientes con deuda/historial.
   - Rutas protegidas con auth.

Recordatorio schema requerido:

- `Client.currentBalance Float @default(0)`
- `Client.creditLimit Float?`
- `Client.isAccountEnabled Boolean @default(true)`
- `Client.accountMovements AccountMovement[]`
- `Sale.isAccountSale Boolean @default(false)`
- `Sale.accountDebtAmount Float @default(0)`
- `Sale.accountMovements AccountMovement[]`
- `AccountMovement` model
- `AccountMovementType`: DEBT, PAYMENT, ADJUSTMENT_POSITIVE, ADJUSTMENT_NEGATIVE, CREDIT_NOTE
- `PaymentMethod.CUENTA_CORRIENTE`
- `CategoryFinance.COBRANZA`
- `MovementType.SALE` y `SALE_CANCEL`
