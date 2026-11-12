import TelaBase from '../components/TelaBase';

export function InicioScreen() {
  return (
    <TelaBase
      titulo="CAM - Calendário Anticoncepcional e Menstrual"
      descricao="Seu acompanhamento diário aparecerá aqui."
    />
  );
}

export function CalendarioScreen() {
  return (
    <TelaBase
      titulo="Calendário"
      descricao="Aqui você acompanhará as datas previstas e seus registros."
    />
  );
}

export function RegistrosScreen() {
  return (
    <TelaBase
      titulo="Registros"
      descricao="Seu histórico de registros aparecerá aqui."
    />
  );
}

export function PerfilScreen() {
  return (
    <TelaBase
      titulo="Perfil"
      descricao="Aqui ficarão seus dados e as configurações do acompanhamento."
    />
  );
}