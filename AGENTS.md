# Instruções para a IA de desenvolvimento

Você está implementando o Vancod Ofertas.

## Prioridade

1. Segurança e conformidade.
2. Arquitetura modular.
3. Código tipado.
4. Testes.
5. Observabilidade.
6. Simplicidade.

## Regras

- Não invente APIs ou endpoints de marketplaces.
- Antes de implementar um connector real, consulte a documentação oficial vigente.
- Se uma API exigir credencial/aprovação, criar adapter e mock, não tentar contornar.
- Não usar scraping como fallback automático sem confirmar que é permitido.
- Não commitar secrets.
- Não misturar regras de marketplace no domínio.
- Toda operação externa deve ter timeout, retry com backoff e tratamento de rate limit.
- Jobs devem ser idempotentes.
- IA não decide fatos; IA apenas redige a partir de dados validados.
- Criar testes para toda regra de negócio importante.
- Atualizar documentação quando arquitetura mudar.

## Estratégia

Comece pelo MVP em modo mock.

Depois habilite um connector real por vez.

Não implemente cinco integrações reais simultaneamente.

## Definition of Done

Uma feature só está pronta quando:

- compila;
- possui testes relevantes;
- tem tratamento de erro;
- não expõe secrets;
- possui documentação;
- possui logs/telemetria adequada;
- não quebra as interfaces dos connectors.
