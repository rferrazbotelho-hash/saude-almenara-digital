# Saúde Almenara Digital

PWA oficial da **Secretaria Municipal de Saúde de Almenara/MG** (SUS Digital).

## Funcionalidades
- **Acesso Unificado (Login & Cadastro):** Seleção de perfil (`Usuário`, `Recepção / Farmácia`, `Gestão`), login por CPF/Senha, cadastro com auxiliar de geolocalização (GPS), WhatsApp, contato de emergência e puxada automática do Cartão SUS (CNS).
- **Portal do Cidadão:** Cartão SUS Digital com QR Code, integração com **Meu SUS Digital** (atualização por CPF de CNS e Cartão de Vacinas), agendamento em 5 UBS com trava anti-duplicidade de 15 dias, fila transparente e consulta REMUME.
- **Painel Operacional (Recepção / Farmácia):** Controle de agenda do dia, encaixe presencial e atualização de estoque REMUME em 1 clique.
- **Gestão Pública & Auditoria (BI):** KPIs em tempo real, gráficos Recharts, logs imutáveis (LGPD/TCE-MG), relação nominal de atendimentos e exportação oficial em PDF com hash SHA-256.

## Execução Local
```bash
npm install
npm run dev
```
