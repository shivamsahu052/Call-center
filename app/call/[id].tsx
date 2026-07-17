import { ChevronLeft } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Header } from '@/components/dialer';
import { useCallDetails } from '@/hooks';
import {
  formatCallDate,
  formatDuration,
  formatPhoneNumber,
  getCallStatusLabel,
  getCallTypeLabel,
} from '@/features/dialer/utils/formatters';

interface NotesForm {
  notes: string;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="border-b border-dialer-border py-4 dark:border-dialer-border-dark">
      <Text className="mb-1 text-xs font-medium uppercase tracking-wide text-dialer-muted dark:text-dialer-muted-dark">
        {label}
      </Text>
      <Text className="text-base text-dialer-text dark:text-dialer-text-dark">{value}</Text>
    </View>
  );
}

export default function CallDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { call, updateCallNotes } = useCallDetails(id ?? '');

  const { control, handleSubmit } = useForm<NotesForm>({
    defaultValues: { notes: call?.notes ?? '' },
  });

  if (!call) {
    return (
      <View className="flex-1 items-center justify-center bg-dialer-bg dark:bg-dialer-bg-dark">
        <Text className="text-dialer-muted dark:text-dialer-muted-dark">Call not found</Text>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text className="text-dialer-primary">Go back</Text>
        </Pressable>
      </View>
    );
  }

  const onSaveNotes = handleSubmit((data) => {
    void updateCallNotes(data.notes);
  });

  return (
    <View className="flex-1 bg-dialer-bg dark:bg-dialer-bg-dark">
      <Header
        title="Call Details"
        onBack={() => router.back()}
        backIcon={ChevronLeft}
      />

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-6 items-center py-6">
          <Text className="text-2xl font-normal text-dialer-text dark:text-dialer-text-dark">
            {call.contactName ?? formatPhoneNumber(call.phoneNumber)}
          </Text>
          {call.contactName ? (
            <Text className="mt-1 text-lg text-dialer-muted dark:text-dialer-muted-dark">
              {formatPhoneNumber(call.phoneNumber)}
            </Text>
          ) : null}
        </View>

        <DetailRow label="Call Type" value={getCallTypeLabel(call.type)} />
        <DetailRow label="Status" value={getCallStatusLabel(call.status)} />
        <DetailRow
          label="Duration"
          value={call.duration > 0 ? formatDuration(call.duration) : '—'}
        />
        <DetailRow label="Date & Time" value={formatCallDate(call.startedAt)} />

        <View className="mt-6">
          <Text className="mb-2 text-xs font-medium uppercase tracking-wide text-dialer-muted dark:text-dialer-muted-dark">
            Notes
          </Text>
          <Controller
            control={control}
            name="notes"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                value={value}
                onChangeText={onChange}
                onBlur={() => {
                  onBlur();
                  onSaveNotes();
                }}
                placeholder="Add call notes..."
                placeholderTextColor="#9AA0A6"
                multiline
                numberOfLines={4}
                className="min-h-[120px] rounded-2xl bg-dialer-surface p-4 text-base text-dialer-text dark:bg-dialer-surface-dark dark:text-dialer-text-dark"
                textAlignVertical="top"
              />
            )}
          />
        </View>
      </ScrollView>
    </View>
  );
}
