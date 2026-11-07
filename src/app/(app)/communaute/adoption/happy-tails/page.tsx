"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { HappyTailCard } from "@/components/adoption/HappyTailCard";
import { useAsync } from "@/components/adoption/hooks";
import { Breadcrumb, ButtonLink, EmptyState, PageLoading } from "@/components/adoption/ui";
import { Alert } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { ADOPTION_ROUTES, countAdoptions, listHappyTails, setHappyTailLike } from "@/lib/adoption";

async function loadHappyTails() {
  const [tails, adopted] = await Promise.all([listHappyTails(), countAdoptions().catch(() => null)]);
  return { tails, adopted };
}

export default function HappyTailsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { data, error, loading } = useAsync(loadHappyTails);
  const [likes, setLikes] = useState<Record<string, string[]>>({});
  const [likeError, setLikeError] = useState("");

  const tails = (data?.tails ?? []).map((t) => ({ ...t, likedBy: likes[t.id] ?? t.likedBy }));

  const toggleLike = useCallback(
    async (id: string, likedBy: string[]) => {
      if (!user) {
        router.push("/connexion");
        return;
      }
      const liked = likedBy.includes(user.uid);
      const next = liked ? likedBy.filter((uid) => uid !== user.uid) : [...likedBy, user.uid];
      setLikes((current) => ({ ...current, [id]: next }));
      setLikeError("");
      try {
        await setHappyTailLike(id, user.uid, !liked);
      } catch (err) {
        console.error(err);
        setLikes((current) => ({ ...current, [id]: likedBy }));
        setLikeError("Votre cœur n'a pas pu être enregistré. Réessayez.");
      }
    },
    [user, router],
  );

  return (
    <div className="relative w-full overflow-hidden">
      <div className="absolute -top-24 left-1/3 w-96 h-96 rounded-full bg-secondary-fixed/30 blur-3xl pointer-events-none" />
      <div className="relative max-w-7xl mx-auto px-margin md:px-margin-md lg:px-margin-lg py-space-lg">
        <Breadcrumb items={[{ label: "Adoption", href: ADOPTION_ROUTES.feed }, { label: "Happy Tails" }]} />

        <header className="flex flex-col md:flex-row md:items-end justify-between gap-space-md mb-space-xl">
          <div className="max-w-2xl">
            <h1 className="font-display-lg-mobile text-display-lg-mobile md:font-display-lg md:text-display-lg tracking-tight">
              Les belles histoires d&apos;adoption
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant mt-space-xs">
              Avant, après : des nouvelles des compagnons qui ont trouvé leur famille grâce à la communauté.
            </p>
          </div>
          {data?.adopted != null && (
            <div className="flex items-center gap-space-sm px-space-lg py-space-md rounded-2xl bg-surface-container-lowest shadow-sm">
              <Icon name="favorite" filled className="text-[#E07A5F] text-[32px]" />
              <div>
                <p className="font-headline-lg text-headline-lg text-[#E07A5F] leading-none">{data.adopted}</p>
                <p className="font-label-md text-label-md text-on-surface-variant">
                  animal{data.adopted > 1 ? "aux" : ""} adopté{data.adopted > 1 ? "s" : ""}
                </p>
              </div>
            </div>
          )}
        </header>

        {(error || likeError) && (
          <div className="mb-space-md">
            <Alert>{error || likeError}</Alert>
          </div>
        )}

        {loading ? (
          <PageLoading />
        ) : tails.length === 0 ? (
          <EmptyState
            icon="auto_awesome"
            title="Aucune histoire pour l'instant"
            text="Après une adoption, l'adoptant peut partager ici son « avant / après »."
            action={<ButtonLink href={ADOPTION_ROUTES.feed}>Découvrir les animaux</ButtonLink>}
          />
        ) : (
          <div className="columns-1 md:columns-2 lg:columns-3 gap-space-lg">
            {tails.map((tail) => (
              <HappyTailCard
                key={tail.id}
                tail={tail}
                liked={Boolean(user && tail.likedBy.includes(user.uid))}
                onToggleLike={() => toggleLike(tail.id, tail.likedBy)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
