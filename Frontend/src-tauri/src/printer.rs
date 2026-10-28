use serde::{Deserialize, Serialize};
use std::io::Write;
use std::net::{SocketAddr, TcpStream, ToSocketAddrs};
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PrinterConfig {
    pub target: String, // "SYSTEM" | "NETWORK" | "BROWSER"
    pub system_printer_name: Option<String>,
    pub network_host: Option<String>,
    pub network_port: Option<u16>,
    pub paper_width: String, // "58mm" | "80mm"
    pub auto_cut: bool,
    pub open_cash_drawer: bool,
}

impl Default for PrinterConfig {
    fn default() -> Self {
        Self {
            target: "BROWSER".to_string(),
            system_printer_name: None,
            network_host: None,
            network_port: Some(9100),
            paper_width: "80mm".to_string(),
            auto_cut: true,
            open_cash_drawer: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReceiptItemDto {
    pub item_name: String,
    pub quantity: i64,
    pub unit_price: f64,
    pub subtotal: f64,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReceiptPrintPayload {
    pub business_name: String,
    pub address: Option<String>,
    pub phone: Option<String>,
    pub gst_number: Option<String>,
    pub order_number: String,
    pub invoice_number: Option<String>,
    pub receipt_reference: Option<String>,
    pub is_offline: bool,
    pub created_at: String,
    pub table_name: Option<String>,
    pub customer_name: Option<String>,
    pub customer_phone: Option<String>,
    pub staff_name: Option<String>,
    pub payment_method: Option<String>,
    pub payment_status: Option<String>,
    pub reference_note: Option<String>,
    pub items: Vec<ReceiptItemDto>,
    pub subtotal: f64,
    pub discount_amount: f64,
    pub coupon_code: Option<String>,
    pub enable_gst: bool,
    pub gst_percentage: f64,
    pub tax_amount: f64,
    pub total_amount: f64,
    pub earned_loyalty_points: Option<i64>,
    pub total_loyalty_points: Option<i64>,
    pub is_reprint: bool,
    pub paper_width: Option<String>, // "58mm" or "80mm"
    pub auto_cut: Option<bool>,
    pub open_drawer: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrintResult {
    pub success: bool,
    pub message: String,
    pub method_used: String, // "SYSTEM" | "NETWORK" | "BROWSER_FALLBACK"
    pub bytes_sent: usize,
}

// ---------------------------------------------------------------------------
// ESC/POS Commands
// ---------------------------------------------------------------------------

const ESC: u8 = 0x1B;
const GS: u8 = 0x1D;

pub struct EscPosBuilder {
    buffer: Vec<u8>,
    width_chars: usize,
}

impl EscPosBuilder {
    pub fn new(paper_width: &str) -> Self {
        let width_chars = if paper_width == "58mm" { 32 } else { 48 };
        let mut b = Self {
            buffer: Vec::with_capacity(1024),
            width_chars,
        };
        b.initialize();
        b
    }

    pub fn initialize(&mut self) -> &mut Self {
        self.buffer.extend_from_slice(&[ESC, b'@']); // Initialize printer
        self
    }

    pub fn align_left(&mut self) -> &mut Self {
        self.buffer.extend_from_slice(&[ESC, b'a', 0]);
        self
    }

    pub fn align_center(&mut self) -> &mut Self {
        self.buffer.extend_from_slice(&[ESC, b'a', 1]);
        self
    }

    pub fn align_right(&mut self) -> &mut Self {
        self.buffer.extend_from_slice(&[ESC, b'a', 2]);
        self
    }

    pub fn text_normal(&mut self) -> &mut Self {
        self.buffer.extend_from_slice(&[ESC, b'!', 0x00]);
        self
    }

    pub fn text_bold(&mut self) -> &mut Self {
        self.buffer.extend_from_slice(&[ESC, b'!', 0x08]);
        self
    }

    pub fn text_double_height(&mut self) -> &mut Self {
        self.buffer.extend_from_slice(&[ESC, b'!', 0x10]);
        self
    }

    pub fn text_double_width(&mut self) -> &mut Self {
        self.buffer.extend_from_slice(&[ESC, b'!', 0x20]);
        self
    }

    pub fn text_double_size(&mut self) -> &mut Self {
        self.buffer.extend_from_slice(&[ESC, b'!', 0x30]); // double height + double width
        self
    }

    pub fn text_line(&mut self, text: &str) -> &mut Self {
        self.buffer.extend_from_slice(text.as_bytes());
        self.buffer.push(b'\n');
        self
    }

    pub fn empty_line(&mut self) -> &mut Self {
        self.buffer.push(b'\n');
        self
    }

    pub fn divider(&mut self, ch: char) -> &mut Self {
        let line: String = std::iter::repeat(ch).take(self.width_chars).collect();
        self.text_line(&line);
        self
    }

    pub fn two_columns(&mut self, left: &str, right: &str) -> &mut Self {
        let total = self.width_chars;
        let right_len = right.chars().count();
        if right_len >= total {
            self.text_line(left);
            self.align_right().text_line(right).align_left();
            return self;
        }

        let max_left = total - right_len - 1;
        let left_chars: Vec<char> = left.chars().collect();
        let left_part: String = if left_chars.len() > max_left {
            left_chars[..max_left].iter().collect()
        } else {
            left.to_string()
        };

        let spaces_count = total.saturating_sub(left_part.chars().count() + right_len);
        let spaces: String = " ".repeat(spaces_count);
        let row = format!("{}{}{}", left_part, spaces, right);
        self.text_line(&row);
        self
    }

    pub fn item_row(&mut self, name: &str, qty: i64, price: f64, amount: f64) -> &mut Self {
        let qty_str = qty.to_string();
        let price_str = format!("{:.2}", price);
        let amount_str = format!("{:.2}", amount);

        if self.width_chars == 32 {
            // 58mm layout: Name(14) Qty(3) Price(6) Amount(7) = 30 + 2 spaces = 32
            let mut name_chars: Vec<char> = name.chars().collect();
            let first_line: String = if name_chars.len() > 14 {
                name_chars.drain(..14).collect()
            } else {
                let s: String = name_chars.drain(..).collect();
                s
            };

            let row = format!(
                "{:<14} {:>3} {:>6} {:>7}",
                first_line, qty_str, price_str, amount_str
            );
            self.text_line(&row);

            // Print remainder of name on next line if wrapped
            if !name_chars.is_empty() {
                let remainder: String = name_chars.into_iter().collect();
                self.text_line(&format!("  {}", remainder));
            }
        } else {
            // 80mm layout: Name(22) Qty(4) Price(9) Amount(10) = 45 + 3 spaces = 48
            let mut name_chars: Vec<char> = name.chars().collect();
            let first_line: String = if name_chars.len() > 22 {
                name_chars.drain(..22).collect()
            } else {
                let s: String = name_chars.drain(..).collect();
                s
            };

            let row = format!(
                "{:<22} {:>4} {:>9} {:>10}",
                first_line, qty_str, price_str, amount_str
            );
            self.text_line(&row);

            if !name_chars.is_empty() {
                let remainder: String = name_chars.into_iter().collect();
                self.text_line(&format!("  {}", remainder));
            }
        }
        self
    }

    pub fn feed(&mut self, lines: u8) -> &mut Self {
        self.buffer.extend_from_slice(&[ESC, b'd', lines]);
        self
    }

    pub fn cut(&mut self) -> &mut Self {
        self.buffer.extend_from_slice(&[GS, b'V', 0x01]); // Partial cut with feed
        self
    }

    pub fn kick_drawer(&mut self) -> &mut Self {
        self.buffer.extend_from_slice(&[ESC, b'p', 0x00, 25, 250]); // Standard pulse to pin 2
        self
    }

    pub fn build(self) -> Vec<u8> {
        self.buffer
    }
}

/// Generates an ESC/POS byte sequence for a standard customer thermal receipt.
pub fn build_escpos_receipt(payload: &ReceiptPrintPayload) -> Vec<u8> {
    let width = payload.paper_width.as_deref().unwrap_or("80mm");
    let mut builder = EscPosBuilder::new(width);

    // 1. Kick cash drawer if configured
    if payload.open_drawer.unwrap_or(false) {
        builder.kick_drawer();
    }

    // 2. Prominent Reprint Header if this is a duplicate print
    if payload.is_reprint {
        builder
            .align_center()
            .text_bold()
            .divider('*')
            .text_double_height()
            .text_line("*** DUPLICATE / REPRINT ***")
            .text_normal()
            .divider('*')
            .empty_line();
    }

    // 3. Business Header
    builder
        .align_center()
        .text_bold()
        .text_double_size()
        .text_line(&payload.business_name)
        .text_normal();

    if let Some(addr) = &payload.address {
        builder.align_center().text_line(addr);
    }
    if let Some(ph) = &payload.phone {
        builder.align_center().text_line(&format!("Ph: {}", ph));
    }
    if let Some(gst) = &payload.gst_number {
        if !gst.trim().is_empty() {
            builder.align_center().text_line(&format!("GSTIN: {}", gst));
        }
    }

    builder.divider('-');

    // 4. Metadata Section
    builder.align_left();

    // Receipt reference vs Invoice Number (Phase 7 truth contract preserved)
    if let Some(ref_num) = &payload.receipt_reference {
        builder.two_columns("Receipt Ref (POS):", ref_num);
        if payload.is_offline {
            builder
                .align_center()
                .text_line("Local POS Receipt")
                .text_line("(Official Tax Invoice Pending Sync)")
                .align_left();
        }
    } else if let Some(inv_num) = &payload.invoice_number {
        builder.two_columns("Invoice No:", inv_num);
    }

    builder.two_columns("Order No:", &payload.order_number);

    // Format created_at date/time
    let clean_date = if payload.created_at.len() >= 19 {
        payload.created_at[..19].replace('T', " ")
    } else {
        payload.created_at.clone()
    };
    builder.two_columns("Date & Time:", &clean_date);

    if let Some(tbl) = &payload.table_name {
        builder.two_columns("Table / Area:", tbl);
    }
    if let Some(cust) = &payload.customer_name {
        builder.two_columns("Customer:", cust);
    }
    if let Some(cust_ph) = &payload.customer_phone {
        if !cust_ph.trim().is_empty() {
            builder.two_columns("Phone:", cust_ph);
        }
    }
    if let Some(staff) = &payload.staff_name {
        builder.two_columns("Cashier / Staff:", staff);
    }

    // Payment Mode & Offline verification notice
    let method = payload
        .payment_method
        .as_deref()
        .unwrap_or("CASH")
        .to_uppercase();
    if payload.is_offline && (method == "UPI" || method == "CARD") {
        builder.two_columns("Payment:", &format!("{} (PENDING VERIFICATION)", method));
        if let Some(ref_note) = &payload.reference_note {
            builder.two_columns("Payment Note:", ref_note);
        }
    } else {
        builder.two_columns("Payment:", &format!("{} (PAID)", method));
    }

    builder.divider('-');

    // 5. Items Header
    if builder.width_chars == 32 {
        builder.text_line("Item             Qty   Price  Amount");
    } else {
        builder.text_line("Item                     Qty      Price     Amount");
    }
    builder.divider('-');

    // 6. Itemized Rows
    for item in &payload.items {
        builder.item_row(
            &item.item_name,
            item.quantity,
            item.unit_price,
            item.subtotal,
        );
        if let Some(notes) = &item.notes {
            if !notes.trim().is_empty() {
                builder.text_line(&format!("  * {}", notes.trim()));
            }
        }
    }

    builder.divider('-');

    // 7. Totals Section
    builder.two_columns("Subtotal:", &format!("INR {:.2}", payload.subtotal));

    if payload.discount_amount > 0.0 {
        let disc_label = if let Some(code) = &payload.coupon_code {
            format!("Discount ({}):", code)
        } else {
            "Discount:".to_string()
        };
        builder.two_columns(&disc_label, &format!("-INR {:.2}", payload.discount_amount));
    }

    if payload.enable_gst && payload.tax_amount > 0.0 {
        let tax_label = format!("GST ({:.1}%):", payload.gst_percentage);
        builder.two_columns(&tax_label, &format!("INR {:.2}", payload.tax_amount));
    }

    builder.divider('=');

    // Grand Total in Bold / Double Height
    builder
        .text_bold()
        .text_double_height()
        .two_columns("GRAND TOTAL:", &format!("INR {:.2}", payload.total_amount))
        .text_normal();

    builder.divider('=');

    // 8. Loyalty Rewards (if applicable)
    if payload.earned_loyalty_points.is_some() || payload.total_loyalty_points.is_some() {
        builder
            .align_center()
            .text_bold()
            .text_line("NextVisit Loyalty Rewards")
            .text_normal()
            .align_left();

        if let Some(pts) = payload.earned_loyalty_points {
            builder.two_columns("Points Earned:", &format!("+{} pts", pts));
        }
        if let Some(bal) = payload.total_loyalty_points {
            builder.two_columns("Total Balance:", &format!("{} pts", bal));
        }
        builder.divider('-');
    }

    // 9. Footer
    builder
        .align_center()
        .text_line("Thank you for visiting!")
        .text_line("Please visit us again.")
        .text_line("Powered by NextVisit POS")
        .empty_line();

    // 10. Feed & Cut
    builder.feed(4);
    if payload.auto_cut.unwrap_or(true) {
        builder.cut();
    }

    builder.build()
}

/// Generates a hardware alignment and functional test receipt.
pub fn build_escpos_test_receipt(paper_width: &str) -> Vec<u8> {
    let mut builder = EscPosBuilder::new(paper_width);
    let cols = builder.width_chars;

    builder
        .align_center()
        .text_bold()
        .text_double_size()
        .text_line("NextVisit POS")
        .text_normal()
        .text_bold()
        .text_line("Thermal Printer Test")
        .text_normal()
        .empty_line()
        .divider('=')
        .align_left()
        .text_line(&format!("Configured Paper Width: {}", paper_width))
        .text_line(&format!("Characters Per Line   : {} cols", cols))
        .divider('-');

    // Width ruler test to verify margin alignment without awkward line wrapping
    let ruler_1: String = (1..=cols).map(|i| ((i % 10) as u8 + b'0') as char).collect();
    builder
        .text_line("Column Boundary Ruler:")
        .text_line(&ruler_1)
        .divider('-');

    // Style checks
    builder
        .align_left()
        .text_line("Left Aligned Text")
        .align_center()
        .text_line("Center Aligned Text")
        .align_right()
        .text_line("Right Aligned Text")
        .align_left()
        .divider('-')
        .text_bold()
        .text_line("Bold Text Check")
        .text_double_height()
        .text_line("Double Height Text")
        .text_double_width()
        .text_line("Double Width Text")
        .text_normal()
        .divider('=')
        .align_center()
        .text_line("PRINTER TEST SUCCESSFUL")
        .text_line("ESC/POS Commands Operating Normal")
        .feed(4)
        .cut();

    builder.build()
}

// ---------------------------------------------------------------------------
// Native Windows Spooler Printing (RAW)
// ---------------------------------------------------------------------------

#[cfg(windows)]
mod winspool {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;

    #[repr(C)]
    struct DocInfo1W {
        p_doc_name: *const u16,
        p_output_file: *const u16,
        p_datatype: *const u16,
    }

    #[link(name = "winspool")]
    extern "system" {
        fn OpenPrinterW(
            p_printer_name: *const u16,
            ph_printer: *mut *mut std::ffi::c_void,
            p_default: *const std::ffi::c_void,
        ) -> i32;
        fn StartDocPrinterW(
            h_printer: *mut std::ffi::c_void,
            level: u32,
            p_doc_info: *const DocInfo1W,
        ) -> u32;
        fn StartPagePrinter(h_printer: *mut std::ffi::c_void) -> i32;
        fn WritePrinter(
            h_printer: *mut std::ffi::c_void,
            p_buf: *const u8,
            cb_buf: u32,
            pc_written: *mut u32,
        ) -> i32;
        fn EndPagePrinter(h_printer: *mut std::ffi::c_void) -> i32;
        fn EndDocPrinter(h_printer: *mut std::ffi::c_void) -> i32;
        fn ClosePrinter(h_printer: *mut std::ffi::c_void) -> i32;
        fn EnumPrintersW(
            flags: u32,
            name: *const u16,
            level: u32,
            p_printer_enum: *mut u8,
            cb_buf: u32,
            pcb_needed: *mut u32,
            pc_returned: *mut u32,
        ) -> i32;
    }

    const PRINTER_ENUM_LOCAL: u32 = 0x00000002;
    const PRINTER_ENUM_CONNECTIONS: u32 = 0x00000004;

    #[repr(C)]
    struct PrinterInfo4W {
        p_printer_name: *mut u16,
        p_server_name: *mut u16,
        attributes: u32,
    }

    fn to_wide(s: &str) -> Vec<u16> {
        OsStr::new(s).encode_wide().chain(Some(0)).collect()
    }

    unsafe fn wide_to_string(ptr: *const u16) -> String {
        if ptr.is_null() {
            return String::new();
        }
        let mut len = 0;
        while *ptr.add(len) != 0 {
            len += 1;
        }
        let slice = std::slice::from_raw_parts(ptr, len);
        String::from_utf16_lossy(slice)
    }

    pub fn list_system_printers() -> Result<Vec<String>, String> {
        unsafe {
            let flags = PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS;
            let mut needed: u32 = 0;
            let mut returned: u32 = 0;

            // First call determines required buffer size
            EnumPrintersW(
                flags,
                std::ptr::null(),
                4,
                std::ptr::null_mut(),
                0,
                &mut needed,
                &mut returned,
            );

            if needed == 0 {
                return Ok(Vec::new());
            }

            let mut buffer = vec![0u8; needed as usize];
            let res = EnumPrintersW(
                flags,
                std::ptr::null(),
                4,
                buffer.as_mut_ptr(),
                needed,
                &mut needed,
                &mut returned,
            );

            if res == 0 {
                let err = std::io::Error::last_os_error();
                return Err(format!("Failed to enumerate Windows printers: {}", err));
            }

            let mut printers = Vec::with_capacity(returned as usize);
            let ptr = buffer.as_ptr() as *const PrinterInfo4W;

            for i in 0..returned {
                let item = &*ptr.add(i as usize);
                let name = wide_to_string(item.p_printer_name);
                if !name.trim().is_empty() {
                    printers.push(name.trim().to_string());
                }
            }

            Ok(printers)
        }
    }

    pub fn print_raw_spooler(
        printer_name: &str,
        doc_name: &str,
        raw_bytes: &[u8],
    ) -> Result<usize, String> {
        if printer_name.trim().is_empty() {
            return Err("System printer name is empty or unselected.".to_string());
        }

        let name_wide = to_wide(printer_name.trim());
        let doc_wide = to_wide(doc_name);
        let raw_type = to_wide("RAW");

        unsafe {
            let mut h_printer: *mut std::ffi::c_void = std::ptr::null_mut();
            let open_ok = OpenPrinterW(name_wide.as_ptr(), &mut h_printer, std::ptr::null());
            if open_ok == 0 || h_printer.is_null() {
                let err = std::io::Error::last_os_error();
                return Err(format!(
                    "Could not open Windows printer '{}': {}. Ensure the printer is turned on and installed.",
                    printer_name, err
                ));
            }

            let doc_info = DocInfo1W {
                p_doc_name: doc_wide.as_ptr(),
                p_output_file: std::ptr::null(),
                p_datatype: raw_type.as_ptr(),
            };

            let job_id = StartDocPrinterW(h_printer, 1, &doc_info);
            if job_id == 0 {
                let err = std::io::Error::last_os_error();
                ClosePrinter(h_printer);
                return Err(format!("Failed to start print job on '{}': {}", printer_name, err));
            }

            let start_page = StartPagePrinter(h_printer);
            if start_page == 0 {
                let err = std::io::Error::last_os_error();
                EndDocPrinter(h_printer);
                ClosePrinter(h_printer);
                return Err(format!("Failed to start print page on '{}': {}", printer_name, err));
            }

            let mut written: u32 = 0;
            let write_ok = WritePrinter(
                h_printer,
                raw_bytes.as_ptr(),
                raw_bytes.len() as u32,
                &mut written,
            );

            EndPagePrinter(h_printer);
            EndDocPrinter(h_printer);
            ClosePrinter(h_printer);

            if write_ok == 0 {
                let err = std::io::Error::last_os_error();
                return Err(format!("Failed writing raw data to '{}': {}", printer_name, err));
            }

            Ok(written as usize)
        }
    }
}

// ---------------------------------------------------------------------------
// Network TCP Direct Printing
// ---------------------------------------------------------------------------

pub fn print_raw_network(host: &str, port: u16, raw_bytes: &[u8]) -> Result<usize, String> {
    let clean_host = host.trim();
    if clean_host.is_empty() {
        return Err("Network printer host/IP is required.".to_string());
    }

    let addr_str = format!("{}:{}", clean_host, port);
    let mut addrs = addr_str
        .to_socket_addrs()
        .map_err(|e| format!("Invalid printer host or port '{addr_str}': {e}"))?;

    let sock_addr: SocketAddr = addrs
        .next()
        .ok_or_else(|| format!("Could not resolve address '{addr_str}'"))?;

    let mut stream = TcpStream::connect_timeout(&sock_addr, Duration::from_secs(3)).map_err(|e| {
        format!(
            "Cannot connect to network printer at {addr_str}: {e}. Ensure printer is powered on and reachable on the local network."
        )
    })?;

    stream
        .set_write_timeout(Some(Duration::from_secs(5)))
        .map_err(|e| format!("Failed to set socket write timeout: {e}"))?;

    stream
        .write_all(raw_bytes)
        .map_err(|e| format!("Failed to transmit data to printer {addr_str}: {e}"))?;

    stream
        .flush()
        .map_err(|e| format!("Failed to flush printer data: {e}"))?;

    Ok(raw_bytes.len())
}

// ---------------------------------------------------------------------------
// Dispatcher Core
// ---------------------------------------------------------------------------

pub fn print_receipt_core(
    config: &PrinterConfig,
    payload: &ReceiptPrintPayload,
) -> Result<PrintResult, String> {
    let raw_bytes = build_escpos_receipt(payload);
    let doc_title = format!("NextVisit Receipt - {}", payload.order_number);

    match config.target.trim().to_uppercase().as_str() {
        "SYSTEM" => {
            #[cfg(windows)]
            {
                let printer_name = config
                    .system_printer_name
                    .as_deref()
                    .unwrap_or("")
                    .trim();
                if printer_name.is_empty() {
                    return Ok(PrintResult {
                        success: false,
                        message: "No Windows system printer selected. Falling back to browser print.".to_string(),
                        method_used: "BROWSER_FALLBACK".to_string(),
                        bytes_sent: 0,
                    });
                }

                match winspool::print_raw_spooler(printer_name, &doc_title, &raw_bytes) {
                    Ok(written) => Ok(PrintResult {
                        success: true,
                        message: format!("Sent {} bytes to Windows printer '{}'", written, printer_name),
                        method_used: "SYSTEM".to_string(),
                        bytes_sent: written,
                    }),
                    Err(e) => {
                        // Crucial Phase 9 guarantee: printer failure does not fail the order, returns clear failure report
                        Ok(PrintResult {
                            success: false,
                            message: format!("Windows printer error: {}. Use browser print fallback.", e),
                            method_used: "BROWSER_FALLBACK".to_string(),
                            bytes_sent: 0,
                        })
                    }
                }
            }
            #[cfg(not(windows))]
            {
                Ok(PrintResult {
                    success: false,
                    message: "Direct Windows spooler is only available on Windows OS. Use browser print fallback.".to_string(),
                    method_used: "BROWSER_FALLBACK".to_string(),
                    bytes_sent: 0,
                })
            }
        }
        "NETWORK" => {
            let host = config.network_host.as_deref().unwrap_or("").trim();
            let port = config.network_port.unwrap_or(9100);

            if host.is_empty() {
                return Ok(PrintResult {
                    success: false,
                    message: "No network printer IP address configured. Use browser print fallback.".to_string(),
                    method_used: "BROWSER_FALLBACK".to_string(),
                    bytes_sent: 0,
                });
            }

            match print_raw_network(host, port, &raw_bytes) {
                Ok(written) => Ok(PrintResult {
                    success: true,
                    message: format!("Transmitted {} bytes to network printer {}:{}", written, host, port),
                    method_used: "NETWORK".to_string(),
                    bytes_sent: written,
                }),
                Err(e) => Ok(PrintResult {
                    success: false,
                    message: format!("Network printer error: {}. Use browser print fallback.", e),
                    method_used: "BROWSER_FALLBACK".to_string(),
                    bytes_sent: 0,
                }),
            }
        }
        _ => {
            // "BROWSER" mode
            Ok(PrintResult {
                success: true,
                message: "Browser print dialog requested.".to_string(),
                method_used: "BROWSER_FALLBACK".to_string(),
                bytes_sent: 0,
            })
        }
    }
}

pub fn print_test_core(config: &PrinterConfig) -> Result<PrintResult, String> {
    let width = &config.paper_width;
    let raw_bytes = build_escpos_test_receipt(width);
    let doc_title = "NextVisit Printer Test";

    match config.target.trim().to_uppercase().as_str() {
        "SYSTEM" => {
            #[cfg(windows)]
            {
                let printer_name = config
                    .system_printer_name
                    .as_deref()
                    .unwrap_or("")
                    .trim();
                if printer_name.is_empty() {
                    return Err("Please select a Windows system printer first.".to_string());
                }

                let written = winspool::print_raw_spooler(printer_name, doc_title, &raw_bytes)?;
                Ok(PrintResult {
                    success: true,
                    message: format!("Printed test slip ({} bytes) on '{}'", written, printer_name),
                    method_used: "SYSTEM".to_string(),
                    bytes_sent: written,
                })
            }
            #[cfg(not(windows))]
            {
                Err("Direct spooler is only available on Windows OS.".to_string())
            }
        }
        "NETWORK" => {
            let host = config.network_host.as_deref().unwrap_or("").trim();
            let port = config.network_port.unwrap_or(9100);
            if host.is_empty() {
                return Err("Please enter a valid printer IP address.".to_string());
            }

            let written = print_raw_network(host, port, &raw_bytes)?;
            Ok(PrintResult {
                success: true,
                message: format!("Printed test slip ({} bytes) to {}:{}", written, host, port),
                method_used: "NETWORK".to_string(),
                bytes_sent: written,
            })
        }
        _ => Err("Test print requires a configured Windows or Network thermal printer.".to_string()),
    }
}

// ---------------------------------------------------------------------------
// Tauri IPC Commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn printer_list_system() -> Result<Vec<String>, String> {
    #[cfg(windows)]
    {
        tauri::async_runtime::spawn_blocking(winspool::list_system_printers)
            .await
            .map_err(|e| format!("Task failed: {e}"))?
    }
    #[cfg(not(windows))]
    {
        Ok(vec![])
    }
}

#[tauri::command]
pub async fn printer_print_receipt(
    config: PrinterConfig,
    payload: ReceiptPrintPayload,
) -> Result<PrintResult, String> {
    tauri::async_runtime::spawn_blocking(move || print_receipt_core(&config, &payload))
        .await
        .map_err(|e| format!("Task failed: {e}"))?
}

#[tauri::command]
pub async fn printer_print_test(config: PrinterConfig) -> Result<PrintResult, String> {
    tauri::async_runtime::spawn_blocking(move || print_test_core(&config))
        .await
        .map_err(|e| format!("Task failed: {e}"))?
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_escpos_builder_58mm_formatting_and_reprint() {
        let payload = ReceiptPrintPayload {
            business_name: "Aroma Cafe".to_string(),
            address: Some("Shop 12, Market".to_string()),
            phone: Some("9876543210".to_string()),
            gst_number: Some("07AAAAA0000A1Z5".to_string()),
            order_number: "ORD-POS01-000005".to_string(),
            invoice_number: None,
            receipt_reference: Some("REC-ORD-POS01-000005".to_string()),
            is_offline: true,
            created_at: "2026-10-19T10:30:00.000Z".to_string(),
            table_name: Some("Table 3".to_string()),
            customer_name: Some("Rahul Sharma".to_string()),
            customer_phone: Some("9998887776".to_string()),
            staff_name: Some("Staff Cashier".to_string()),
            payment_method: Some("CASH".to_string()),
            payment_status: Some("RECORDED_OFFLINE".to_string()),
            reference_note: None,
            items: vec![
                ReceiptItemDto {
                    item_name: "Paneer Tikka Roll Extra Spicy".to_string(),
                    quantity: 2,
                    unit_price: 150.0,
                    subtotal: 300.0,
                    notes: Some("Extra mint chutney".to_string()),
                },
                ReceiptItemDto {
                    item_name: "Cold Coffee".to_string(),
                    quantity: 1,
                    unit_price: 80.0,
                    subtotal: 80.0,
                    notes: None,
                },
            ],
            subtotal: 380.0,
            discount_amount: 30.0,
            coupon_code: Some("WELCOME30".to_string()),
            enable_gst: true,
            gst_percentage: 5.0,
            tax_amount: 17.5,
            total_amount: 367.5,
            earned_loyalty_points: Some(36),
            total_loyalty_points: Some(150),
            is_reprint: true,
            paper_width: Some("58mm".to_string()),
            auto_cut: Some(true),
            open_drawer: Some(true),
        };

        let bytes = build_escpos_receipt(&payload);
        assert!(!bytes.is_empty());

        let receipt_text = String::from_utf8_lossy(&bytes);

        // Verify reprint banner is prominently included
        assert!(receipt_text.contains("*** DUPLICATE / REPRINT ***"));

        // Verify business details
        assert!(receipt_text.contains("Aroma Cafe"));
        assert!(receipt_text.contains("07AAAAA0000A1Z5"));

        // Verify Phase 7 offline receipt reference
        assert!(receipt_text.contains("REC-ORD-POS01-000005"));
        assert!(receipt_text.contains("Local POS Receipt"));
        assert!(receipt_text.contains("Pending Sync"));

        // Verify items and wrapped long name
        assert!(receipt_text.contains("Paneer Tikka"));
        assert!(receipt_text.contains("Extra mint chutney"));
        assert!(receipt_text.contains("Cold Coffee"));

        // Verify totals
        assert!(receipt_text.contains("380.00"));
        assert!(receipt_text.contains("WELCOME30"));
        assert!(receipt_text.contains("367.50"));

        // Verify loyalty
        assert!(receipt_text.contains("+36 pts"));
        assert!(receipt_text.contains("150 pts"));

        // Verify cut and drawer kick bytes
        assert!(bytes.windows(2).any(|w| w == [GS, b'V']));
        assert!(bytes.windows(2).any(|w| w == [ESC, b'p']));
    }

    #[test]
    fn test_escpos_builder_80mm_online_invoice() {
        let payload = ReceiptPrintPayload {
            business_name: "NextVisit Bistro".to_string(),
            address: None,
            phone: None,
            gst_number: None,
            order_number: "ORD-POS01-000006".to_string(),
            invoice_number: Some("INV-000006".to_string()),
            receipt_reference: None,
            is_offline: false,
            created_at: "2026-10-19T11:00:00.000Z".to_string(),
            table_name: Some("Table 5".to_string()),
            customer_name: Some("Guest".to_string()),
            customer_phone: None,
            staff_name: None,
            payment_method: Some("UPI".to_string()),
            payment_status: Some("PAID".to_string()),
            reference_note: None,
            items: vec![ReceiptItemDto {
                item_name: "Butter Chicken".to_string(),
                quantity: 1,
                unit_price: 320.0,
                subtotal: 320.0,
                notes: None,
            }],
            subtotal: 320.0,
            discount_amount: 0.0,
            coupon_code: None,
            enable_gst: true,
            gst_percentage: 5.0,
            tax_amount: 16.0,
            total_amount: 336.0,
            earned_loyalty_points: None,
            total_loyalty_points: None,
            is_reprint: false,
            paper_width: Some("80mm".to_string()),
            auto_cut: Some(true),
            open_drawer: Some(false),
        };

        let bytes = build_escpos_receipt(&payload);
        let text = String::from_utf8_lossy(&bytes);

        // Not a reprint
        assert!(!text.contains("*** DUPLICATE / REPRINT ***"));

        // Online invoice
        assert!(text.contains("INV-000006"));
        assert!(text.contains("ORD-POS01-000006"));
        assert!(text.contains("Butter Chicken"));
        assert!(text.contains("336.00"));
        assert!(text.contains("UPI (PAID)"));
    }

    #[test]
    fn test_escpos_test_receipt_generation() {
        let bytes_58 = build_escpos_test_receipt("58mm");
        assert!(!bytes_58.is_empty());
        let text_58 = String::from_utf8_lossy(&bytes_58);
        assert!(text_58.contains("Thermal Printer Test"));
        assert!(text_58.contains("58mm"));

        let bytes_80 = build_escpos_test_receipt("80mm");
        assert!(!bytes_80.is_empty());
        let text_80 = String::from_utf8_lossy(&bytes_80);
        assert!(text_80.contains("80mm"));
        assert!(text_80.contains("PRINTER TEST SUCCESSFUL"));
    }

    #[test]
    fn test_printer_unreachable_network_does_not_panic() {
        let config = PrinterConfig {
            target: "NETWORK".to_string(),
            system_printer_name: None,
            network_host: Some("127.0.0.1".to_string()),
            network_port: Some(19999), // unreachable port
            paper_width: "80mm".to_string(),
            auto_cut: true,
            open_cash_drawer: false,
        };

        let res = print_test_core(&config);
        assert!(res.is_err());
        let err_msg = res.unwrap_err();
        assert!(err_msg.contains("Cannot connect") || err_msg.contains("127.0.0.1"));
    }

    #[test]
    fn test_system_printer_enumeration_does_not_crash() {
        #[cfg(windows)]
        {
            let printers = winspool::list_system_printers().unwrap();
            // Should succeed and return installed printers (e.g. Microsoft Print to PDF)
            assert!(printers.len() >= 1);
            assert!(printers.iter().any(|p| p.contains("PDF") || p.contains("Print") || !p.is_empty()));
        }
    }
}
