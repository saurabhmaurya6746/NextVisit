# NextVisit Phase 9: Receipt & Thermal Printer Support Architecture

## 1. Executive Summary

NextVisit Phase 9 adds native POS thermal receipt printing to the NextVisit Desktop app (Windows/Tauri) while preserving high-fidelity browser print fallback for Web runtimes. It supports ESC/POS command protocol over two primary hardware transports:
1. **Windows Print Spooler (`winspool.drv`)**: Transmits raw binary ESC/POS streams directly to any installed Windows printer (`RAW` datatype), supporting USB, Bluetooth, Virtual COM, and manufacturer drivers without GDI distortion.
2. **Raw Network TCP Socket (Port 9100)**: Connects directly over LAN/Wi-Fi to network receipt printers via TCP port 9100 with bounded connect (3s) and write (5s) timeouts.
3. **Browser Fallback (`window.print`)**: Used when running in a web browser, when configured as fallback, or when physical hardware fails.

---

## 2. Zero-Loss Order Guarantee

**Core Rule:** A printer failure must **NEVER** abort, rollback, or lose an order or payment.
- The order and payment transaction are fully committed to local SQLite and the sync outbox *before* printer dispatch is invoked.
- If physical printer dispatch encounters an error (paper out, printer unplugged, TCP timeout, spooler error), the error is caught, reported to the operator via toast notification, and automatically offered as a standard browser print dialog fallback (`window.print`).
- The order remains safely saved and eligible for background cloud synchronization.

---

## 3. Truth Contract & Phase 7 Alignment

Thermal receipts strictly honor the offline truth contract established in Phase 7:
- **Offline Unsynced Orders**:
  - Receipt header displays: `Receipt Ref (POS): REC-ORD-...`
  - Tax invoice note: `Local POS Receipt · Tax Invoice Pending Cloud Sync`
  - Payment status: `RECORDED_OFFLINE (Verification Pending)`
- **Online / Synced Orders**:
  - Official tax invoice header: `Invoice No: INV-...`
  - Official business tax credentials (GSTIN).

---

## 4. Anti-Fraud Reprint Marking

To prevent billing fraud and bill swapping:
- The printer service maintains an in-memory session registry (`printedOrdersSet`) and inspects order completion status (`SERVED`).
- Any receipt printed for an already-printed order or an existing served order automatically injects a prominent duplicate warning banner:
  - **ESC/POS Thermal**: Bold inverted / centered banner:
    ```
    ================================
       *** DUPLICATE / REPRINT ***
    ================================
    ```
  - **UI / PDF**: Rose-colored alert box displaying `*** DUPLICATE / REPRINT ***`.

---

## 5. Technical Specification

### 5.1 Command Language: ESC/POS
Standard EPSON ESC/POS binary codes are generated directly in Rust:
- **Initialize**: `ESC @` (`\x1b\x40`)
- **Alignment**: `ESC a n` (`0` = Left, `1` = Center, `2` = Right)
- **Text Formatting**: `ESC E n` (Bold toggle), `ESC ! n` (Size selection)
- **Auto-Cut**: `GS V 1` (`\x1d\x56\x01` - partial cut leaving small uncut point)
- **Cash Drawer Kick**: `ESC p 0 25 250` (`\x1b\x70\x00\x19\xfa` - 24V pulse to RJ-11 drawer)

### 5.2 Paper Width Formats
- **58mm (2-inch POS)**: 32 columns per line. Compact layout with word-wrapping for dish names and itemized qty/prices.
- **80mm (3-inch Restaurant POS)**: 48 columns per line. Full tabular layout with Item, Qty, Price, and Total columns.

### 5.3 Diagnostic Test Receipt
The operator can trigger a diagnostic test slip from the **Printer Settings Dialog** to verify hardware connectivity, column ruler, text styles, cash drawer kick, and paper cutting before taking live customer orders.

---

## 6. Implementation Components

1. **Rust / Tauri Backend (`Frontend/src-tauri/src/printer.rs`)**:
   - `EscPosBuilder`: High-performance binary builder for 58mm and 80mm formatting with word wrap and dividers.
   - `winspool`: Raw Windows Spooler FFI bindings (`OpenPrinterW`, `StartDocPrinterW`, `WritePrinter`, `ClosePrinter`, `EnumPrintersW`).
   - `print_raw_network`: Direct TCP socket streamer for port 9100.
   - Tauri Commands: `printer_list_system`, `printer_print_receipt`, `printer_print_test`.
2. **Frontend Service (`Frontend/src/lib/printer/printer-service.ts`)**:
   - Manages printer config persistence in localStorage (`nv_printer_config_<businessId>`).
   - Handles `listSystemPrinters`, `printTestReceipt`, `dispatchReceiptPrint`, and reprint tracking.
3. **Operator Dialog (`Frontend/src/components/printer-settings-dialog.tsx`)**:
   - Connection selector: Windows Spooler / Network TCP / Browser Print.
   - Installed printer dropdown with live refresh.
   - Paper width selector (58mm vs 80mm).
   - Hardware switches: Auto-cut, Cash drawer pulse, Auto-print on settlement.
   - One-click "Print Test Slip" button.
4. **Invoice & Order UI Integration**:
   - `Frontend/src/components/invoice-view.tsx`: Thermal print button, configuration launcher, and reprint banner.
   - `Frontend/src/components/order-detail-sheet.tsx`: Automated receipt print on order settlement and reprint flag passing.
   - `Frontend/src/components/topbar.tsx`: Direct printer configuration icon button in the header.
