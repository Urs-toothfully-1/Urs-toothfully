import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { ROUTES } from "@/lib/constants"
import { Sidebar } from "@/components/dashboard/Sidebar"
import { Header } from "@/components/dashboard/Header"
import { prisma } from "@/lib/prisma"

async function getBranchName(branchId: string): Promise<string> {
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { name: true },
  })
  return branch?.name ?? "Unknown"
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  if (!session) {
    redirect(ROUTES.login)
  }

  const branchName = await getBranchName(session.branchId)

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      {/* Sidebar */}
      <Sidebar role={session.role} branchName={branchName} />

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header
          userName={session.name}
          role={session.role}
          branchName={branchName}
        />
        <main className="flex-1 overflow-y-auto p-6 bg-[#EBECEE]">
          {children}
        </main>
      </div>
    </div>
  )
}
