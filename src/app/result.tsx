import { router } from 'expo-router';
import { Alert } from 'react-native';

import { ResultView } from '@/components/result-view';
import { Screen } from '@/components/ui';
import { useAnalysis } from '@/lib/analysis';
import { addToCalendar } from '@/lib/calendar';
import { useSettings } from '@/lib/settings';

export default function Result() {
  const { t } = useSettings();
  const { state, reset } = useAnalysis();

  return (
    <Screen>
      <ResultView
        state={state}
        t={t}
        onShowSource={(ref) =>
          router.push({ pathname: '/source', params: { section: ref.section, index: ref.index } })
        }
        onReport={(ref) =>
          router.push({ pathname: '/report', params: { section: ref.section, index: ref.index } })
        }
        onAddToCalendar={(event) =>
          addToCalendar(event).catch(() => Alert.alert(t('result.calendarError')))
        }
        onNewLetter={() => {
          reset();
          router.dismissTo('/');
        }}
      />
    </Screen>
  );
}
