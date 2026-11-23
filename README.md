# CAM — Calendário Anticoncepcional e Menstrual

Aplicativo Android desenvolvido como Projeto Integrador do curso de Sistemas de Informação da Universidade Paranaense - UNIPAR.

O CAM reúne acompanhamento anticoncepcional, acompanhamento menstrual, registros diários, calendário, histórico e lembretes locais. Sua proposta é oferecer uma configuração personalizável, com interface simples e funcionamento independente de serviços externos para armazenar e consultar os dados.

## Objetivo

Desenvolver uma aplicação que permita organizar informações relacionadas ao uso de anticoncepcionais e ao acompanhamento menstrual, respeitando as diferenças entre esses contextos.

No acompanhamento anticoncepcional, a aplicação utiliza o método, a frequência das ações e as regras de pausa informadas pela usuária. No acompanhamento menstrual, utiliza a duração habitual do ciclo e os períodos efetivamente registrados para apresentar estimativas.

O aplicativo possui caráter de acompanhamento e organização de informações. Não realiza diagnósticos, não prescreve métodos contraceptivos e não recomenda alterações no regime de utilização.

## Funcionalidades

### Acesso e perfil

- Cadastro de um único perfil por dispositivo.
- Autenticação local por e-mail e senha.
- Restauração da sessão após reabrir o aplicativo.
- Encerramento da sessão sem exclusão do histórico.
- Edição do nome, e-mail e data de nascimento.
- Configuração de preferências do calendário.

### Acompanhamento anticoncepcional

- Seleção do método e da ação acompanhada.
- Configuração da frequência das ações, em dias.
- Definição da data de referência e do horário previsto.
- Uso contínuo ou com pausas.
- Pausa após uma quantidade de dias de uso ou de ações previstas.
- Registro de ações realizadas antecipadamente, na data prevista ou com atraso.
- Preservação da agenda planejada independentemente da data real das confirmações.

### Acompanhamento menstrual

- Configuração da última menstruação e das durações habituais do ciclo e do sangramento.
- Registro de início e fim de períodos menstruais.
- Atualização das estimativas a partir dos inícios menstruais registrados.
- Apresentação do dia estimado do ciclo.
- Classificação explícita do sangramento, sem presumir que todo sangramento seja menstruação.

### Registros, calendário e histórico

- Registro de sangramento, humor, sintomas e observações.
- Associação dos acontecimentos às respectivas datas e horários.
- Consulta, edição e exclusão de registros anteriores.
- Calendário com marcadores distintos para previsões e acontecimentos reais.
- Histórico agrupado pela data real dos acontecimentos.
- Consulta de datas futuras sem permitir o lançamento de acontecimentos realizados.

### Lembretes e notificações

- Avisos das ações anticoncepcionais e dos períodos de pausa.
- Avisos de início e fim previstos da menstruação.
- Lembrete de registro diário.
- Convite semanal para consultar o histórico.
- Lembretes personalizados.
- Ativação, desativação e edição das preferências.
- Separação dos avisos conforme o modo de acompanhamento.

## Tecnologias utilizadas

| Tecnologia | Versão declarada | Aplicação |
|---|---|---|
| React Native | `0.88.1` | Desenvolvimento da interface e integração com a plataforma móvel |
| React | `19.3.0` | Composição dos componentes e gerenciamento de estado |
| TypeScript | `~6.0.3` | Tipagem estática e validação das interfaces de código |
| Expo | `~58.0.26` | Configuração e ferramentas de desenvolvimento |
| Expo SQLite | `~58.0.18` | Persistência relacional local |
| Expo SecureStore | `~58.0.3` | Armazenamento protegido do segredo da sessão |
| Expo Crypto | `~58.0.8` | Geração de valores aleatórios e operações de hash |
| React Native Quick Crypto | `^1.1.9` | Derivação de senhas com processamento nativo |
| Expo Notifications | `~58.1.9` | Agendamento e apresentação de notificações locais |
| Expo Dev Client | `~58.0.21` | Compilação personalizada para desenvolvimento |
| Vitest | `^5.1.0` | Testes automatizados das regras de domínio |
| EAS Build | Ferramenta de compilação | Geração dos APKs de desenvolvimento e distribuição interna |

## Organização do projeto

```text
CAM/
├── assets/                         # Imagens, ícones e recursos visuais
├── src/
│   ├── auth/
│   │   ├── AuthContext.tsx         # Estado de autenticação e sessão
│   │   └── authService.ts          # Cadastro, login e proteção das credenciais
│   │
│   ├── components/
│   │   ├── FormularioComTeclado.tsx
│   │   ├── ResumoConfiguracao.tsx
│   │   └── TelaBase.tsx
│   │
│   ├── database/
│   │   ├── database.ts             # Conexão e execução das migrações
│   │   ├── schema.ts               # Estrutura e versões do banco
│   │   ├── acompanhamentoRepository.ts
│   │   ├── configuracaoPerfilRepository.ts
│   │   ├── registrosRepository.ts
│   │   ├── linhaDoTempoRepository.ts
│   │   ├── lembretesRepository.ts
│   │   └── ...                     # Demais consultas e operações de persistência
│   │
│   ├── domain/
│   │   ├── contraceptivo/          # Frequências, uso, pausas e retomadas
│   │   ├── menstrual/              # Ciclos, períodos e estimativas menstruais
│   │   ├── datas.ts                # Validação e cálculos entre datas
│   │   ├── onboarding.ts           # Conversão e validação dos formulários
│   │   ├── formularioConfiguracao.ts
│   │   ├── linhaDoTempo.ts         # Organização de previsões e acontecimentos
│   │   └── planoNotificacoes.ts    # Regras para geração dos avisos
│   │
│   ├── features/
│   │   ├── registros/
│   │   │   ├── RegistrosProvider.tsx
│   │   │   └── useLinhaDoTempo.ts
│   │   └── notificacoes/
│   │       ├── NotificacoesProvider.tsx
│   │       ├── NotificacoesScreen.tsx
│   │       └── notificacoesService.ts
│   │
│   ├── navigation/
│   │   ├── AcompanhamentoGate.tsx  # Encaminhamento para onboarding ou abas
│   │   └── AppNavigator.tsx        # Configuração da navegação inferior
│   │
│   └── screens/
│       ├── AuthScreen.tsx
│       ├── OnboardingScreen.tsx
│       ├── InicioScreen.tsx
│       ├── CalendarioScreen.tsx
│       ├── RegistrosScreen.tsx
│       └── PerfilScreen.tsx
│
├── App.tsx                         # Composição dos providers e fluxo inicial
├── index.ts                        # Registro do componente principal
├── app.json                        # Configuração da aplicação e plugins nativos
├── eas.json                        # Perfis de compilação
├── package.json
├── package-lock.json
├── tsconfig.json
└── LICENSE
```

Os testes automatizados ficam próximos das implementações de domínio, em arquivos com o sufixo .test.ts.

## Arquitetura

O projeto adota uma organização em camadas, complementada por módulos agrupados por funcionalidade.

| Camada ou módulo | Responsabilidade |
|---|---|
| `screens` | Apresentar informações e receber interações da usuária |
| `components` | Reutilizar elementos visuais e comportamentos de interface |
| `domain` | Executar cálculos, validações e regras de acompanhamento |
| `database` | Consultar e persistir informações no SQLite |
| `auth` | Gerenciar credenciais e sessão local |
| `features` | Coordenar fluxos de registros, formulários e notificações |
| `navigation` | Definir o acesso ao onboarding e às telas principais |

### Composição e gerenciamento de estado

O estado compartilhado utiliza Context API:

- **`AuthProvider`:** disponibiliza a usuária autenticada e as operações de acesso.
- **`RegistrosProvider`:** controla a abertura dos formulários e sinaliza alterações nos registros.
- **`NotificacoesProvider`:** disponibiliza a configuração dos avisos e coordena sua atualização.

O `AcompanhamentoGate` verifica a existência de uma configuração salva. Enquanto ela não existir, apresenta o onboarding. Após sua conclusão, disponibiliza a navegação por abas.

Os formulários de registros e as configurações auxiliares são apresentados em modais.

### Linha do tempo compartilhada

Calendário e histórico utilizam uma consulta compartilhada em `linhaDoTempoRepository.ts`, seguida pela organização das informações em `domain/linhaDoTempo.ts`.

Essa decisão mantém as duas telas consistentes quanto a:

- Datas reais dos acontecimentos.
- Confirmações vinculadas às previsões.
- Períodos de pausa.
- Sangramentos e menstruações registrados.
- Situações ainda não confirmadas.

Uma previsão passada sem confirmação é apresentada como **“Não registrado”**. Essa condição indica ausência de informação no aplicativo e não comprova que a ação deixou de ser realizada.

## Decisões de domínio

### Regras anticoncepcionais

A frequência é calculada a partir de uma data de referência:

- A cada 7 dias: ações nos dias 1, 8, 15 e assim sucessivamente.
- Pausa após 21 dias de uso: utilização nos dias 1 a 21 e início da pausa no dia 22.
- Pausa após três ações com intervalo de 7 dias: ações nos dias 1, 8 e 15, com pausa após completar o último intervalo, no dia 22.

As contagens utilizam as ações previstas. Confirmações antecipadas, atrasadas ou ausentes não deslocam a agenda.

### Regras menstruais

As estimativas utilizam a duração habitual do ciclo e do sangramento, considerando o início menstrual real mais recente aplicável à consulta.

No modo menstrual, classificar um sangramento como menstruação pode criar um período quando não houver outro cobrindo a data. Registros nos dias seguintes do mesmo período preservam seu início.

Um período aberto permanece sem data final até que a usuária informe o encerramento. As previsões não criam nem encerram períodos reais automaticamente.

### Versionamento das configurações

As configurações possuem início e fim de vigência. O fim é exclusivo: uma configuração encerrada no dia 15 deixa de valer nesse dia, quando a seguinte pode começar.

Alterações pelo Perfil começam em uma data futura, preservando as configurações anteriores e seus registros vinculados. Programações futuras podem ser substituídas, desde que não existam acontecimentos vinculados que impeçam essa operação.

### Tratamento das datas

As datas do acompanhamento são armazenadas como `AAAA-MM-DD`, e os horários como `HH:mm`.

Os cálculos entre dias utilizam referências em UTC para evitar diferenças indevidas causadas pela duração dos dias locais. Já os instantes das notificações são construídos conforme o horário local do dispositivo.

## Persistência local

O banco `oi-utero.db` é criado e atualizado automaticamente pelo aplicativo.

| Tabela | Finalidade |
|---|---|
| `perfis` | Dados pessoais, credenciais derivadas e hash da sessão |
| `configuracoes` | Modos de acompanhamento e respectivas vigências |
| `registros_diarios` | Humor, sangramento, horário e observações |
| `sintomas_registrados` | Sintomas associados ao diário |
| `acoes_realizadas` | Ações anticoncepcionais e vínculos com previsões |
| `menstruacoes` | Início e fim dos períodos registrados |
| `lembretes` | Preferências e identificadores dos avisos |
| `onboarding_rascunhos` | Retomada da configuração inicial |
| `preferencias` | Preferências de apresentação do calendário |

As migrações são controladas por `PRAGMA user_version`. O banco utiliza chaves estrangeiras, restrições de integridade e modo WAL.

O modelo permite um único perfil por instalação. Os períodos menstruais e os diários são entidades distintas: excluir uma anotação diária não exclui automaticamente o período menstrual correspondente.

## Autenticação e privacidade

A autenticação acontece localmente, sem serviço externo de identificação.

A proteção das credenciais utiliza:

- PBKDF2 com SHA-256.
- 600.000 iterações.
- Salt aleatório de 16 bytes.
- Resultado derivado de 32 bytes.
- Processamento nativo por `react-native-quick-crypto`.

A senha original não é armazenada. O SQLite guarda o resultado derivado, o salt e os parâmetros utilizados.

A sessão utiliza um segredo aleatório armazenado no SecureStore. Seu hash é mantido no banco para validação e invalidação no encerramento da sessão.

O SecureStore protege o segredo da sessão; o banco SQLite não utiliza criptografia integral nesta implementação.

O aplicativo não implementa sincronização do histórico com servidor. O backup automático Android está desativado em `app.json`. A desinstalação ou a limpeza dos dados remove o histórico local.

## Notificações locais

O plano de avisos é calculado em `domain/planoNotificacoes.ts` e sincronizado com o sistema operacional por `notificacoesService.ts`.

Os agendamentos recorrentes cobrem uma janela de 30 dias, renovada ao abrir o aplicativo, retornar ao primeiro plano ou atualizar registros e preferências. Lembretes personalizados únicos podem utilizar uma data específica.

A sincronização utiliza identificadores estáveis para preservar avisos inalterados, atualizar os modificados e cancelar os que deixaram de ser necessários.

As notificações respeitam o modo de acompanhamento válido na data de entrega. Ações já confirmadas e registros diários já existentes também são considerados no planejamento.

A entrega depende das permissões, dos canais de notificação e das políticas de bateria e alarmes do Android. O recebimento deve ser validado em aparelho físico, incluindo segundo plano e reinicialização.

## Execução do projeto

### Pré-requisitos

- Git.
- npm.
- Node.js.
- Dispositivo Android ou emulador.
- Conta Expo com acesso ao projeto EAS configurado, para compilações em nuvem.

### Instalação

```bash
git clone https://github.com/agdabjd/CAM.git
cd CAM
npm ci
```

O comando `npm ci` utiliza as versões registradas em `package-lock.json`.

### Compilação de desenvolvimento

O projeto utiliza bibliotecas nativas adicionais, incluindo `react-native-quick-crypto`. Por isso, a execução completa requer uma compilação de desenvolvimento própria.

```bash
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile development
```

Instale o APK gerado e inicie o servidor:

```bash
npx expo start --dev-client
```

Conecte o aplicativo instalado ao servidor informado pelo Expo.

### APK para distribuição interna

```bash
npx eas-cli@latest build --platform android --profile preview
```

O perfil `preview` gera um APK com o código incorporado, capaz de funcionar sem o servidor de desenvolvimento.

Para preservar os dados em uma atualização, mantenha o identificador Android e a assinatura do aplicativo.

## Delimitação do escopo

A entrega concentra-se no acompanhamento local e individual. Não contempla controle de estoque, contagem de cartelas, relatórios PDF, atividade sexual, compartilhamento com parceiros ou sincronização em nuvem.

As datas menstruais são estimativas baseadas nas informações fornecidas e nos registros da usuária. O sistema não calcula diagnósticos nem substitui acompanhamento profissional.

## Autoria

Projeto desenvolvido por:

- Agda Beatriz Jedliczka Domingues, RA 60000631.
- Letícia Masquietto de Oliveira Silva, RA 60300765.

Curso de Sistemas de Informação - Universidade Paranaense, UNIPAR.  
Projeto Integrador - 2026.