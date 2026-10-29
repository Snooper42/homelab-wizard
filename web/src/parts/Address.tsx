// An address that a narrow screen breaks after a dot or a colon, never
// inside a word (photos.<wbr>example.<wbr>com).
export function Address({ text }: { text: string }) {
  return <>{text.split(/(?<=[.:])/).map((t, i) => <>{i ? <wbr /> : null}{t}</>)}</>;
}
