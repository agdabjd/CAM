import { Text, View } from 'react-native';

import type { NovaConfiguracao } from '../database/acompanhamentoRepository';

import { formatarData } from '../domain/onboarding';
import { hojeLocal } from '../domain/datas';

import {
  calcularDia,
  pausaAtualOuProxima,
  proximasAcoes,
} from '../domain/contraceptivo/regime';

import {
  calcularDiaMenstrual,
  periodoPrevistoAtualOuProximo,
} from '../domain/menstrual/cicloMenstrual';

export default function ResumoConfiguracao({
  dados,
}: {
  dados: NovaConfiguracao;
}) {
  const hoje = hojeLocal();

  if (dados.modo === 'menstrual') {
    const dia = calcularDiaMenstrual(dados, hoje);
    const periodo = periodoPrevistoAtualOuProximo(dados, hoje);

    return (
      <View style={{ gap: 12 }}>
        <Text style={{ fontSize: 20, fontWeight: '600' }}>
          Acompanhamento menstrual
        </Text>

        <Text>
          Referência: {formatarData(dados.dataReferencia)}
        </Text>

        <Text>Ciclo habitual: {dados.duracaoCicloDias} dias</Text>

        <Text>
          Menstruação habitual: {dados.duracaoMenstruacaoDias} dias
        </Text>

        {dia.diaDoCicloEstimado !== null && (
          <Text>
            Dia estimado do ciclo: {dia.diaDoCicloEstimado}
          </Text>
        )}

        <Text>
          {periodo.emAndamento
            ? 'Período previsto atual'
            : 'Próximo período previsto'}
          : {formatarData(periodo.inicio)} a{' '}
          {formatarData(periodo.fim)}
        </Text>

        <Text style={{ color: '#71677E' }}>
          Essas datas são estimativas. Os registros realizados
          serão apresentados separadamente.
        </Text>
      </View>
    );
  }

  const situacao = calcularDia(dados, hoje);
  const acoes = proximasAcoes(dados, hoje, 3);
  const pausa = pausaAtualOuProxima(dados, hoje);

  const textos = {
    antes_inicio: 'O período de uso ainda não começou',
    acao_prevista: 'Há uma ação prevista para hoje',
    uso_em_andamento: 'Período de uso',
    pausa: 'Período de pausa',
  };

  return (
    <View style={{ gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: '600' }}>
        {dados.metodo}
      </Text>

      <Text>Ação: {dados.acao}</Text>

      <Text>
        Referência: {formatarData(dados.dataReferencia)}
      </Text>

      <Text>
        Frequência: a cada {dados.intervaloDias} dia(s), às{' '}
        {dados.horario}
      </Text>

      <Text>
        {dados.pausa.tipo === 'nenhuma'
          ? 'Uso contínuo, sem pausa'
          : `Pausa de ${dados.pausa.duracaoDias} dia(s) após ${
              dados.pausa.apos
            } ${
              dados.pausa.tipo === 'dias'
                ? 'dia(s) de uso'
                : 'ação(ões) prevista(s)'
            }`}
      </Text>

      <Text>Hoje: {textos[situacao.situacao]}</Text>

      <Text style={{ fontWeight: '600' }}>
        Próximas ações previstas
      </Text>

      {acoes.map((acao) => (
        <Text key={acao.data}>
          • {formatarData(acao.data)} às {acao.horario}
        </Text>
      ))}

      {pausa && (
        <Text>
          {pausa.emAndamento ? 'Pausa atual' : 'Próxima pausa'}:{' '}
          {formatarData(pausa.inicio)} a {formatarData(pausa.fim)}.
          Retomada: {formatarData(pausa.retomada)}.
        </Text>
      )}

      <Text style={{ color: '#71677E' }}>
        Registrar uma ação não altera automaticamente a agenda.
      </Text>
    </View>
  );
}