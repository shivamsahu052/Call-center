import { Delete, Phone, Star, Users, Wifi, WifiOff } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DialButton, DialPad } from '@/components/dialer';
import { DIALER_FONT_FAMILY } from '@/constants';
import { cn } from '@/features/dialer/utils/formatters';
import { useDialer } from '@/hooks';
import type { Contact } from '@/types';

function ContactChip({
  contact,
  onPress,
  variant,
  compact,
}: {
  contact: Contact;
  onPress: (contact: Contact) => void;
  variant: 'recent' | 'favorite';
  compact: boolean;
}) {
  const avatarSize = compact ? 40 : 46;

  return (
    <Pressable
      onPress={() => onPress(contact)}
      className="mr-3 items-center"
      accessibilityRole="button"
      accessibilityLabel={`Call ${contact.name}`}
    >
      <View
        className={cn(
          'mb-1 items-center justify-center rounded-full',
          variant === 'favorite'
            ? 'bg-amber-100 dark:bg-amber-900/30'
            : 'bg-dialer-surface dark:bg-dialer-surface-dark',
        )}
        style={{ height: avatarSize, width: avatarSize }}
      >
        <Text
          className="text-sm font-semibold text-dialer-primary"
          maxFontSizeMultiplier={1.1}
          style={{ fontFamily: DIALER_FONT_FAMILY, lineHeight: 18 }}
        >
          {contact.avatarInitials ?? contact.name.slice(0, 2).toUpperCase()}
        </Text>
      </View>
      <Text
        className="max-w-[64px] text-center text-xs text-dialer-muted dark:text-dialer-muted-dark"
        maxFontSizeMultiplier={1.1}
        numberOfLines={1}
        style={{ fontFamily: DIALER_FONT_FAMILY, lineHeight: 16 }}
      >
        {contact.name.split(' ')[0]}
      </Text>
    </Pressable>
  );
}

export default function DialerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
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
  const isCompact = height < 820;
  const isNarrow = width <= 360;
  const useCompactControls = isCompact || isNarrow;
  const dialPadSize = useCompactControls ? 'compact' : 'default';
  const numberFontSize = isCompact ? 26 : isNarrow ? 28 : 32;
  const numberDisplayHeight = isCompact ? 54 : 66;
  const actionButtonSize = useCompactControls ? 64 : 72;
  const sectionSpacing = isCompact ? 8 : 12;

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
      <View
        className="flex-1 px-4"
        style={{ paddingBottom: isCompact ? 8 : 12 }}
      >
        <View
          className="flex-row items-center justify-center"
          style={{ height: isCompact ? 28 : 34 }}
        >
          {connectionStatus === 'connecting' ? (
            <>
              <ActivityIndicator size="small" color="#5F6368" />
              <Text
                className="ml-2 text-xs text-dialer-muted dark:text-dialer-muted-dark"
                maxFontSizeMultiplier={1.1}
                style={{ fontFamily: DIALER_FONT_FAMILY, lineHeight: 16 }}
              >
                Connecting
              </Text>
            </>
          ) : connectionStatus === 'connected' ? (
            <>
              <Wifi size={14} color="#34A853" />
              <Text
                className="ml-2 text-xs text-dialer-muted dark:text-dialer-muted-dark"
                maxFontSizeMultiplier={1.1}
                style={{ fontFamily: DIALER_FONT_FAMILY, lineHeight: 16 }}
              >
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
                className="ml-2 flex-shrink text-xs text-dialer-end"
                maxFontSizeMultiplier={1.1}
                numberOfLines={1}
                style={{ fontFamily: DIALER_FONT_FAMILY, lineHeight: 16 }}
              >
                {connectionError || 'Server unavailable'} - Retry
              </Text>
            </Pressable>
          )}
        </View>

        {/* Number display */}
        <View
          className="items-center justify-center"
          style={{
            minHeight: numberDisplayHeight,
            paddingHorizontal: isNarrow ? 4 : 12,
          }}
        >
          <Text
            adjustsFontSizeToFit
            className="w-full text-center font-light text-dialer-text dark:text-dialer-text-dark"
            maxFontSizeMultiplier={1.05}
            minimumFontScale={0.58}
            numberOfLines={1}
            style={{
              fontFamily: DIALER_FONT_FAMILY,
              fontSize: numberFontSize,
              lineHeight: numberFontSize + 8,
            }}
          >
            {formattedNumber || 'Enter number'}
          </Text>
        </View>

        {/* Shortcuts */}
        {recentContacts.length > 0 ? (
          <View style={{ marginBottom: sectionSpacing }}>
            <View className="mb-1 flex-row items-center">
              <Users size={14} color="#5F6368" />
              <Text
                className="ml-1.5 text-xs font-medium uppercase text-dialer-muted dark:text-dialer-muted-dark"
                maxFontSizeMultiplier={1.1}
                style={{ fontFamily: DIALER_FONT_FAMILY, lineHeight: 16 }}
              >
                Recent
              </Text>
            </View>
            <FlatList
              horizontal
              data={recentContacts}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              style={{ flexGrow: 0 }}
              renderItem={({ item }) => (
                <ContactChip
                  compact={useCompactControls}
                  contact={item}
                  onPress={handleContactSelect}
                  variant="recent"
                />
              )}
            />
          </View>
        ) : null}

        {favoriteContacts.length > 0 ? (
          <View style={{ marginBottom: sectionSpacing }}>
            <View className="mb-1 flex-row items-center">
              <Star size={14} color="#5F6368" />
              <Text
                className="ml-1.5 text-xs font-medium uppercase text-dialer-muted dark:text-dialer-muted-dark"
                maxFontSizeMultiplier={1.1}
                style={{ fontFamily: DIALER_FONT_FAMILY, lineHeight: 16 }}
              >
                Favorites
              </Text>
            </View>
            <FlatList
              horizontal
              data={favoriteContacts}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              style={{ flexGrow: 0 }}
              renderItem={({ item }) => (
                <ContactChip
                  compact={useCompactControls}
                  contact={item}
                  onPress={handleContactSelect}
                  variant="favorite"
                />
              )}
            />
          </View>
        ) : null}

        {/* Keypad */}
        <View className="flex-1 justify-center">
          <DialPad
            onDigitPress={handleDigitPress}
            onDigitLongPress={handleDigitLongPress}
            size={dialPadSize}
          />
        </View>

        {/* Action row */}
        <View
          className="flex-row items-center justify-center"
          style={{ height: actionButtonSize, marginBottom: isCompact ? 8 : 12 }}
        >
          <View style={{ width: actionButtonSize }} />

          <DialButton
            icon={Phone}
            onPress={() => void handleCall()}
            variant="call"
            size={useCompactControls ? 'default' : 'large'}
            disabled={!canCall}
            className={isNarrow ? 'mx-6' : 'mx-8'}
          />

          <Pressable
            onPress={backspace}
            onLongPress={clearDialedNumber}
            disabled={dialedNumber.length === 0}
            accessibilityRole="button"
            accessibilityLabel="Backspace"
            className="items-center justify-center"
            style={{ height: actionButtonSize, width: actionButtonSize }}
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
