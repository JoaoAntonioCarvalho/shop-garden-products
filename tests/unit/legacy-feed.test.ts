import { describe, expect, it } from "vitest";
import { LEGACY_FEED_HEADERS, parseLegacyFeed } from "@/server/admin/legacy-feed";

const product = (fields: string) => `<produto>${fields}</produto>`;
const xml = `<?xml version='1.0' encoding='ISO-8859-1'?>
<loja nome='Loja de exemplo'>
${product(
  "<id_produto>11</id_produto><Ref>abc1</Ref><filtro nome='Cor'>Azul</filtro>" +
    "<link_produto>https://www.exemplo.com.br/vaso-azul-11</link_produto>" +
    "<descricao>Vaso  de cer&#226;mica &amp; barro</descricao><DescricaoCurta>VASO DE CERÂMICA & BARRO</DescricaoCurta>" +
    "<DescricaoLonga>Linha 1\n\nEnviamos para todo Brasil.</DescricaoLonga><Peso>1300 g</Peso>" +
    "<preco>R$ 1.064,50</preco><preco_normal>R$ 1.200,00</preco_normal>" +
    "<imagem>https://www.exemplo.com.br/prod/vaso.jpg</imagem>" +
    "<descritor nome='Marca'>Marca Exemplo</descritor><categoria>Cachepot, Cer&#226;mica</categoria>",
)}
${product(
  "<id_produto>12</id_produto><Ref>ABC1</Ref><link_produto>https://www.exemplo.com.br/prod,idproduto,12,planta</link_produto>" +
    "<descricao>Planta grande</descricao><DescricaoCurta>Planta para sala</DescricaoCurta>" +
    "<DescricaoLonga>Entregamos para toda Cidade de São Paulo.</DescricaoLonga><Peso>500 g</Peso>" +
    "<preco>R$ 80,00</preco><preco_normal>R$ 80,00</preco_normal><imagem></imagem><categoria>Plantas Naturais</categoria>",
)}
${product(
  "<id_produto>13</id_produto><Ref></Ref><link_produto></link_produto><descricao>Substrato 50 L</descricao>" +
    "<DescricaoCurta></DescricaoCurta><DescricaoLonga>Saco grande.</DescricaoLonga><Peso>350000 g</Peso>" +
    "<preco>R$ 30,00</preco><preco_normal>R$ 30,00</preco_normal><imagem></imagem><categoria>Jardinagem, Substratos</categoria>",
)}
<regs>3</regs>
</loja>`;

describe("XML de produtos do site antigo", () => {
  const feed = parseLegacyFeed(xml);
  const row = (index: number) =>
    Object.fromEntries(
      LEGACY_FEED_HEADERS.map((header, column) => [header, feed.rows[index][column]]),
    );

  it("lê nome, preço, peso, foto, marca e categoria, decodificando as entidades", () => {
    expect(row(0)).toEqual({
      sku_produto: "ABC1",
      nome: "Vaso de cerâmica & barro",
      categoria: "Cachepot, Cerâmica",
      marca: "Marca Exemplo",
      descricao_curta: "", // repetia o nome
      descricao: "Linha 1\n\nEnviamos para todo Brasil.",
      preco: "1064,50",
      preco_de: "1200,00",
      peso_gramas: "1300",
      imagem: "https://www.exemplo.com.br/prod/vaso.jpg",
    });
    expect(row(1).descricao_curta).toBe("Planta para sala");
    expect(row(1).preco_de).toBe("");
  });

  it("desempata referências repetidas e cria um código quando não há referência", () => {
    expect(feed.rows.map((item) => item[0])).toEqual(["ABC1", "ABC1-12", "FC13"]);
  });

  it("marca como só local pelo texto ou pelo peso de 350 kg, e não guarda esse peso", () => {
    expect(feed.localOnlySkus).toEqual(["ABC1-12", "FC13"]);
    expect(row(2).peso_gramas).toBe("");
  });

  it("guarda o caminho antigo de cada produto", () => {
    expect(feed.oldPaths).toEqual({
      ABC1: "/vaso-azul-11",
      "ABC1-12": "/prod,idproduto,12,planta",
    });
  });
});
