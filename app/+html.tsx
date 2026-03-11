import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
    return (
        <html lang="de">
            <head>
                <meta charSet="utf-8" />
                <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1, shrink-to-fit=no"
                />
                <title>Gross ICT - Portal</title>
                <link rel="icon" type="image/png" href="/favicon.png" />
                <style dangerouslySetInnerHTML={{
                    __html: `
                    * { scrollbar-width: thin !important; scrollbar-color: rgba(51,136,221,0.4) transparent !important; }
                    *::-webkit-scrollbar { width: 6px !important; height: 6px !important; }
                    *::-webkit-scrollbar-track { background: transparent !important; }
                    *::-webkit-scrollbar-thumb { background: rgba(51,136,221,0.4) !important; border-radius: 3px !important; }
                    *::-webkit-scrollbar-thumb:hover { background: rgba(51,136,221,0.7) !important; }
                `}} />
                <ScrollViewStyleReset />
            </head>
            <body>{children}</body>
        </html>
    );
}
