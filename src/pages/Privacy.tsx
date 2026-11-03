import { course } from '@/config/course';
import { t } from '@/i18n/t';

/** Plain-English privacy page generated from course.yml. Text is in en.json so it stays course-neutral. */
export function Privacy() {
  const auth = course.modules.auth !== 'none';
  return (
    <article style={{ display: 'grid', gap: 16 }}>
      <h1>{t('privacy.title')}</h1>
      {!auth ? (
        <p>{t('privacy.noAuth')}</p>
      ) : (
        <>
          <p>{t('privacy.auth.intro')}</p>
          <h2>{t('privacy.auth.what')}</h2>
          <p>{t('privacy.auth.items')}</p>
          <p>{t('privacy.auth.recordings')}</p>
          <h2>{t('privacy.auth.why')}</h2>
          <p>{t('privacy.auth.whyText')}</p>
          <h2>{t('privacy.auth.who')}</h2>
          <p>{t('privacy.auth.whoText')}</p>
          <h2>{t('privacy.auth.withdraw')}</h2>
          <p>{t('privacy.auth.withdrawText')}</p>
        </>
      )}
    </article>
  );
}
