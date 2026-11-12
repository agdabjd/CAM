import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import {
  InicioScreen,
  CalendarioScreen,
  RegistrosScreen,
  PerfilScreen,
} from '../screens';

type TabParamList = {
  Inicio: undefined;
  Calendario: undefined;
  Registros: undefined;
  Perfil: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

const icones: Record<
  keyof TabParamList,
  keyof typeof Ionicons.glyphMap
> = {
  Inicio: 'home-outline',
  Calendario: 'calendar-outline',
  Registros: 'list-outline',
  Perfil: 'person-outline',
};

export default function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#8563A6',
        tabBarInactiveTintColor: '#827A8B',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#EAE3F0',
        },
        tabBarLabelStyle: {
          fontSize: 11,
        },
        tabBarIcon: ({ color, size }) => (
          <Ionicons
            name={icones[route.name]}
            size={size}
            color={color}
          />
        ),
      })}
    >
      <Tab.Screen
        name="Inicio"
        component={InicioScreen}
        options={{ title: 'Início' }}
      />

      <Tab.Screen
        name="Calendario"
        component={CalendarioScreen}
        options={{ title: 'Calendário' }}
      />

      <Tab.Screen
        name="Registros"
        component={RegistrosScreen}
      />

      <Tab.Screen
        name="Perfil"
        component={PerfilScreen}
      />
    </Tab.Navigator>
  );
}