import {
  Grid3X3,
  Mic,
  MicOff,
  PhoneOff,
  Volume2,
  Pause,
  Play,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CallCard, DialButton, DialPad } from '@/components/dialer';
import { useActiveCall } from '@/hooks';
import { useCallStore } from '@/store';

export default function ActiveCallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const activeCall = useCallStore((s) => s.activeCall);
  const {
    toggleMute,
    toggleSpeaker,
    toggleHold,
    toggleKeypad,
    sendDtmf,
    handleEndCall,
  } = useActiveCall();

  useEffect(() => {
    if (!activeCall) {
      router.replace('/(tabs)');
    }
  }, [activeCall, router]);

  if (!activeCall) {
    return null;
  }

  return (
    <View
      className="flex-1 bg-dialer-bg dark:bg-dialer-bg-dark"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom + 16 }}
    >
      <View className="flex-1 justify-between">
        <CallCard call={activeCall} className="pt-12" />

        {activeCall.isKeypadVisible ? (
          <View className="px-4">
            <DialPad
              onDigitPress={(digit) => {
                sendDtmf(digit);
              }}
              size="compact"
            />
          </View>
        ) : (
          <View className="px-6">
            <View className="mb-8 flex-row justify-around">
              <DialButton
                label="Mute"
                icon={activeCall.isMuted ? MicOff : Mic}
                onPress={toggleMute}
                active={activeCall.isMuted}
              />
              <DialButton
                label="Speaker"
                icon={Volume2}
                onPress={toggleSpeaker}
                active={activeCall.isSpeakerOn}
              />
              <DialButton
                label="Hold"
                icon={activeCall.isOnHold ? Play : Pause}
                onPress={toggleHold}
                active={activeCall.isOnHold}
              />
            </View>

            <View className="flex-row justify-around">
              <DialButton
                label="Keypad"
                icon={Grid3X3}
                onPress={toggleKeypad}
                active={activeCall.isKeypadVisible}
              />
              <View className="w-16" />
              <View className="w-16" />
            </View>
          </View>
        )}

        <View className="items-center pb-4">
          <DialButton
            icon={PhoneOff}
            onPress={() => handleEndCall()}
            variant="end"
            size="large"
          />
          <Text className="mt-2 text-xs text-dialer-muted dark:text-dialer-muted-dark">
            End Call
          </Text>
        </View>
      </View>
    </View>
  );
}
