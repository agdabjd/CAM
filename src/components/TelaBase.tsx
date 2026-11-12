import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = {
  titulo: string;
  descricao: string;
};

export default function TelaBase({ titulo, descricao }: Props) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.titulo}>{titulo}</Text>

      <View style={styles.cartao}>
        <Text style={styles.descricao}>{descricao}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF7FC',
    padding: 24,
  },
  titulo: {
    fontSize: 26,
    fontWeight: '600',
    color: '#182235',
    marginBottom: 24,
  },
  cartao: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EAE3F0',
    padding: 20,
  },
  descricao: {
    fontSize: 16,
    lineHeight: 24,
    color: '#71677E',
  },
});