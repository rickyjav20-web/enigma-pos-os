declare module '@point-of-sale/receipt-printer-encoder' {
    interface TableColumn {
        width: number;
        align?: 'left' | 'center' | 'right';
    }

    interface EncoderOptions {
        columns?: number;
        language?: string;
    }

    export default class ReceiptPrinterEncoder {
        constructor(options?: EncoderOptions);
        initialize(): this;
        align(value: 'left' | 'center' | 'right'): this;
        bold(value: boolean): this;
        underline(value: boolean): this;
        size(width: number, height: number): this;
        line(text: string): this;
        newline(): this;
        rule(): this;
        table(columns: TableColumn[], rows: string[][]): this;
        cut(): this;
        encode(): Uint8Array;
    }
}

declare module '@point-of-sale/webbluetooth-receipt-printer' {
    export default class WebBluetoothReceiptPrinter {
        constructor();
        connect(): Promise<void>;
        disconnect(): Promise<void>;
        print(data: Uint8Array): Promise<void>;
        addEventListener(event: string, callback: (e?: any) => void): void;
        removeEventListener(event: string, callback: (e?: any) => void): void;
    }
}
