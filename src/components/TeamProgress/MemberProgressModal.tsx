import { useEffect, useRef, useState } from 'preact/hooks';
import { wireframeJSONToSVG } from 'roadmap-renderer';
import { Spinner } from '../ReactIcons/Spinner';
import '../FrameRenderer/FrameRenderer.css';
import { useOutsideClick } from '../../hooks/use-outside-click';
import { useKeydown } from '../../hooks/use-keydown';
import type { TeamMember } from './TeamProgressPage';
import { httpGet } from '../../lib/http';
import { renderTopicProgress } from '../../lib/resource-progress';
import CloseIcon from '../../icons/close.svg';
import { useToast } from '../../hooks/use-toast';

export type ProgressMapProps = {
  member: TeamMember;
  teamId: string;
  resourceId: string;
  resourceType: 'roadmap' | 'best-practice';
  onClose: () => void;
};

type MemberProgressResponse = {
  removed: string[];
  done: string[];
  learning: string[];
  skipped: string[];
};

export function MemberProgressModal(props: ProgressMapProps) {
  const { resourceId, member, resourceType, teamId, onClose } = props;

  const containerEl = useRef<HTMLDivElement>(null);
  const popupBodyEl = useRef<HTMLDivElement>(null);

  const [memberProgress, setMemberProgress] =
    useState<MemberProgressResponse>();
  const [isLoading, setIsLoading] = useState(true);
  const toast = useToast();

  let resourceJsonUrl = 'https://roadmap.sh';
  if (resourceType === 'roadmap') {
    resourceJsonUrl += `/${resourceId}.json`;
  } else {
    resourceJsonUrl += `/best-practices/${resourceId}.json`;
  }

  async function getMemberProgress(
    teamId: string,
    memberId: string,
    resourceType: string,
    resourceId: string
  ) {
    const { error, response } = await httpGet<MemberProgressResponse>(
      `${
        import.meta.env.PUBLIC_API_URL
      }/v1-get-member-resource-progress/${teamId}/${memberId}?resourceType=${resourceType}&resourceId=${resourceId}`
    );
    if (error || !response) {
      toast.error(error?.message || 'Failed to get member progress');
      return;
    }

    setMemberProgress(response);

    return response;
  }

  async function renderResource(jsonUrl: string) {
    const res = await fetch(jsonUrl);
    const json = await res.json();
    const svg = await wireframeJSONToSVG(json, {
      fontURL: '/fonts/balsamiq.woff2',
    });

    containerEl.current?.replaceChildren(svg);
  }

  useKeydown('Escape', () => {
    onClose();
  });

  useOutsideClick(popupBodyEl, () => {
    onClose();
  });

  useEffect(() => {
    if (
      !containerEl.current ||
      !resourceJsonUrl ||
      !resourceId ||
      !resourceType ||
      !teamId
    ) {
      return;
    }

    Promise.all([
      renderResource(resourceJsonUrl),
      getMemberProgress(teamId, member._id, resourceType, resourceId),
    ])
      .then(([_, memberProgress = {}]) => {
        const {
          removed = [],
          done = [],
          learning = [],
          skipped = [],
        } = memberProgress;

        done.forEach((id: string) => renderTopicProgress(id, 'done'));
        learning.forEach((id: string) => renderTopicProgress(id, 'learning'));
        skipped.forEach((id: string) => renderTopicProgress(id, 'skipped'));
        removed.forEach((id: string) => renderTopicProgress(id, 'removed'));
      })
      .catch((err) => {
        console.error(err);
        toast.error(err?.message || 'Something went wrong. Please try again!');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const currProgress = member.progress.find((p) => p.resourceId === resourceId);
  const memberDone = currProgress?.done || 0;
  const memberLearning = currProgress?.learning || 0;
  const memberSkipped = currProgress?.skipped || 0;
  const memberTotal = currProgress?.total || 0;

  const progressPercentage = Math.round((memberDone / memberTotal) * 100);

  return (
    <div class="fixed left-0 right-0 top-0 z-50 h-full items-center justify-center overflow-y-auto overflow-x-hidden overscroll-contain bg-black/50">
      <div class="relative mx-auto h-full w-full max-w-4xl p-4 md:h-auto">
        <div
          ref={popupBodyEl}
          class="popup-body relative rounded-lg bg-white shadow"
        >
          <div className="p-4">
            <div className="mb-5 mt-0 text-left md:mt-4 md:text-center">
              <h2 className={'mb-1 text-lg font-bold md:text-2xl'}>
                {member.name}'s Progress
              </h2>
              <p
                className={
                  'hidden text-xs text-gray-500 sm:text-sm md:block md:text-base'
                }
              >
                You are looking at {member.name}'s progress.{' '}
                <a
                  target={'_blank'}
                  href={`/${resourceId}?t=${teamId}`}
                  className="text-blue-600 underline"
                >
                  View your progress
                </a>
                .
              </p>
              <p className={'block text-gray-500 md:hidden'}>
                View your progress&nbsp;
                <a
                  target={'_blank'}
                  href={`/${resourceId}?t=${teamId}`}
                  className="text-blue-600 underline"
                >
                  on the roadmap page.
                </a>
              </p>
            </div>
            <p class="-mx-4 mb-3 flex items-center justify-start border-b border-t py-2 text-sm sm:hidden px-4">
              <span class="mr-2.5 block rounded-sm bg-yellow-200 px-1 py-0.5 text-xs font-medium uppercase text-yellow-900">
                <span>{progressPercentage}</span>% Done
              </span>

              <span>
                <span>{memberDone}</span> of <span>{memberTotal}</span> done
              </span>
            </p>
            <p class="-mx-4 mb-3 hidden items-center justify-center border-b border-t py-2 text-sm sm:flex">
              <span class="mr-2.5 block rounded-sm bg-yellow-200 px-1 py-0.5 text-xs font-medium uppercase text-yellow-900">
                <span>{progressPercentage}</span>% Done
              </span>

              <span>
                <span>{memberDone}</span> completed
              </span>
              <span class="mx-1.5 text-gray-400">·</span>
              <span>
                <span data-progress-learning="">{memberLearning}</span> in
                progress
              </span>

              {memberSkipped > 0 && (
                <>
                  <span class="mx-1.5 text-gray-400">·</span>
                  <span>
                    <span data-progress-skipped="">{memberSkipped}</span>{' '}
                    skipped
                  </span>
                </>
              )}

              <span class="mx-1.5 text-gray-400">·</span>
              <span>
                <span data-progress-total="">{memberTotal}</span> Total
              </span>
            </p>
          </div>

          <div ref={containerEl} className="px-4 pb-2"></div>

          {isLoading && (
            <div class="flex w-full justify-center">
              <Spinner
                isDualRing={false}
                className="mb-4 mt-2 h-4 w-4 animate-spin fill-blue-600 text-gray-200 sm:h-8 sm:w-8"
              />
            </div>
          )}

          <button
            type="button"
            className="popup-close absolute right-2.5 top-3 ml-auto inline-flex items-center rounded-lg bg-transparent p-1.5 text-sm text-gray-400 hover:bg-gray-200 hover:text-gray-900 sm:hidden"
            onClick={onClose}
          >
            <img src={CloseIcon} className="h-4 w-4" />
            <span class="sr-only">Close modal</span>
          </button>
        </div>
      </div>
    </div>
  );
}
