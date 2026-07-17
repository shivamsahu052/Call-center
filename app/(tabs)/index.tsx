import { Delete, Phone, Star, Users, Wifi, WifiOff } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DialButton, DialPad } from '@/components/dialer';
import { useDialer } from '@/hooks';
import type { Contact } from '@/types';
import { cn } from '@/features/dialer/utils/formatters';

function ContactChip({
  contact,
  onPress,
  variant,
}: {
  contact: Contact;
  onPress: (contact: Contact) => void;
  variant: 'recent' | 'favorite';
}) {
  return (
    <Pressable
      onPress={() => onPress(contact)}
      className="mr-3 items-center"
      accessibilityRole="button"
      accessibilityLabel={`Call ${contact.name}`}
    >
      <View
        className={cn(
          'mb-1 h-12 w-12 items-center justify-center rounded-full',
          variant === 'favorite' ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-dialer-surface dark:bg-dialer-surface-dark',
        )}
      >
        <Text className="text-sm font-semibold text-dialer-primary">
          {contact.avatarInitials ?? contact.name.slice(0, 2).toUpperCase()}
        </Text>
      </View>
      <Text className="max-w-[64px] text-center text-xs text-dialer-muted dark:text-dialer-muted-dark" numberOfLines={1}>
        {contact.name.split(' ')[0]}
      </Text>
    </Pressable>
  );
}

export default function DialerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    formattedNumber,
    dialedNumber,
    canCall,
    recentContacts,
    favoriteContacts,
    connectionStatus,
    connectionError,
    retryConnection,
    handleDigitPress,
    handleDigitLongPress,
    backspace,
    clearDialedNumber,
    selectContact,
    placeCall,
  } = useDialer();

  const handleCall = async () => {
    if (!canCall) return;
    const call = await placeCall();
    if (call) {
      router.push('/call/active');
    }
  };

  const handleContactSelect = (contact: Contact) => {
    selectContact(contact);
  };

  return (
    <View
      className="flex-1 bg-dialer-bg dark:bg-dialer-bg-dark"
      style={{ paddingTop: insets.top }}
    >
      <View className="flex-1 px-4">
        <View className="h-9 flex-row items-center justify-center">
          {connectionStatus === 'connecting' ? (
            <>
              <ActivityIndicator size="small" color="#5F6368" />
              <Text className="ml-2 text-xs text-dialer-muted dark:text-dialer-muted-dark">
                Connecting
              </Text>
            </>
          ) : connectionStatus === 'connected' ? (
            <>
              <Wifi size={14} color="#34A853" />
              <Text className="ml-2 text-xs text-dialer-muted dark:text-dialer-muted-dark">
                Server connected
              </Text>
            </>
          ) : (
            <Pressable
              onPress={() => void retryConnection()}
              className="flex-row items-center"
              accessibilityRole="button"
              accessibilityLabel="Retry server connection"
            >
              <WifiOff size={14} color="#EA4335" />
              <Text
                className="ml-2 max-w-[240px] text-xs text-dialer-end"
                numberOfLines={1}
              >
                {connectionError || 'Server unavailable'} · Retry
              </Text>
            </Pressable>
          )}
        </View>

        {/* Number display */}
        <View className="min-h-[80px] items-center justify-center px-8">
          <Text
            className="text-center text-4xl font-light tracking-wide text-dialer-text dark:text-dialer-text-dark"
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {formattedNumber || 'Enter number'}
          </Text>
        </View>

        {/* Shortcuts */}
        <View className="mb-4">
          <View className="mb-2 flex-row items-center">
            <Users size={14} color="#5F6368" />
            <Text className="ml-1.5 text-xs font-medium uppercase tracking-wide text-dialer-muted dark:text-dialer-muted-dark">
              Recent
            </Text>
          </View>
          <FlatList
            horizontal
            data={recentContacts}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <ContactChip contact={item} onPress={handleContactSelect} variant="recent" />
            )}
          />
        </View>

        <View className="mb-6">
          <View className="mb-2 flex-row items-center">
            <Star size={14} color="#5F6368" />
            <Text className="ml-1.5 text-xs font-medium uppercase tracking-wide text-dialer-muted dark:text-dialer-muted-dark">
              Favorites
            </Text>
          </View>
          <FlatList
            horizontal
            data={favoriteContacts}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <ContactChip contact={item} onPress={handleContactSelect} variant="favorite" />
            )}
          />
        </View>

        {/* Keypad */}
        <DialPad
          onDigitPress={handleDigitPress}
          onDigitLongPress={handleDigitLongPress}
          className="flex-1 justify-center"
        />

        {/* Action row */}
        <View className="mb-6 flex-row items-center justify-center">
          <View className="w-[72px]" />

          <DialButton
            icon={Phone}
            onPress={() => void handleCall()}
            variant="call"
            size="large"
            disabled={!canCall}
            className="mx-8"
          />

          <Pressable
            onPress={backspace}
            onLongPress={clearDialedNumber}
            disabled={dialedNumber.length === 0}
            accessibilityRole="button"
            accessibilityLabel="Backspace"
            className="h-[72px] w-[72px] items-center justify-center"
          >
            <Delete
              size={28}
              color={dialedNumber.length > 0 ? '#5F6368' : '#DADCE0'}
              strokeWidth={1.5}
            />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
