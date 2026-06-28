import Document, {
  Html,
  Head,
  Main,
  NextScript,
  type DocumentContext,
  type DocumentInitialProps,
} from 'next/document';

interface MyDocumentProps extends DocumentInitialProps {
  lang: string;
}

class MyDocument extends Document<MyDocumentProps> {
  static async getInitialProps(ctx: DocumentContext): Promise<MyDocumentProps> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const initialProps = await (Document as any).getInitialProps(ctx);
    // 从 Accept-Language 头解析首选语言，回退到 'en'
    const acceptLang = ctx.req?.headers?.['accept-language'];
    const lang = acceptLang?.split(',')[0]?.split('-')[0] || 'en';
    return { ...initialProps, lang };
  }

  render() {
    return (
      <Html lang={this.props.lang}>
        <Head />
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default MyDocument;
