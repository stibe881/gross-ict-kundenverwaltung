// Polyfill TextDecoder to catch 'latin1' unsupported encoding errors in React Native
if (typeof global !== 'undefined' && global.TextDecoder) {
  const OriginalTextDecoder = global.TextDecoder;
  class PolyfilledTextDecoder {
    decoder: any;
    constructor(label?: string, options?: TextDecoderOptions) {
      try {
        this.decoder = new OriginalTextDecoder(label, options);
      } catch (e) {
        // Fallback to utf-8 if the environment (like Expo's winter TextDecoder) doesn't support 'latin1'
        this.decoder = new OriginalTextDecoder('utf-8', options);
      }
    }
    decode(input?: any, options?: any) {
      return this.decoder.decode(input, options);
    }
    get encoding() { return this.decoder.encoding; }
    get fatal() { return this.decoder.fatal; }
    get ignoreBOM() { return this.decoder.ignoreBOM; }
  }
  global.TextDecoder = PolyfilledTextDecoder as any;
}

const { jsPDF } = require("jspdf");
export { jsPDF };
