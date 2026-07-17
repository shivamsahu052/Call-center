import { useRouter } from 'expo-router';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HistoryCard, TabBar } from '@/components/dialer';
import { useCallHistory } from '@/hooks';
import type { CallRecord } from '@/types';

export default function CallHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activeTab, setActiveTab, activeCalls, tabs, isRefreshing, refresh } =
    useCallHistory();

  const handleCallPress = (call: CallRecord) => {
    router.push(`/call/${call.id}`);
  };

  return (
    <View
      className="flex-1 bg-dialer-bg dark:bg-dialer-bg-dark"
      style={{ paddingTop: insets.top }}
    >
      <View className="px-4 pb-2">
        <Text className="text-2xl font-normal text-dialer-text dark:text-dialer-text-dark">
          Recents
        </Text>
      </View>

      <TabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      <FlatList
        data={activeCalls}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => void refresh()} />
        }
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <HistoryCard call={item} onPress={handleCallPress} />}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-20">
            <Text className="text-dialer-muted dark:text-dialer-muted-dark">
              No {activeTab} calls
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => (
          <View className="ml-[68px] h-px bg-dialer-border dark:bg-dialer-border-dark" />
        )}
      />
    </View>
  );
}
