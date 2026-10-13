! Reference driver for packjt77.f90 (WSJT-X 2.7.0), used to check the JS port.
!
! Reads one command per line from stdin and writes one result line per command.
! Fields in the result are separated by '|'. Trailing blanks are trimmed.
!
!   G <msg>          genft8 text path: fmtmsg, pack77 (i3=n3=-1), unpack77(nrx=0)
!                    -> G|c77|i3|n3|ok|msgsent
!   P <msg>          pack77 only, no fmtmsg (i3=n3=-1)       -> P|c77|i3|n3
!   T <msg>          pack77 with telemetry hint (i3=0, n3=5) -> T|c77|i3|n3
!   U <nrx> <c77>    unpack77                                -> U|ok|msg
!   M <call>         set mycall13                            -> M
!   D <call>         set dxcall13                            -> D
!   X <call>         set dxbase                              -> X
!   H <call>         save_hash_call                          -> H|n10|n12|n22 (-1 if not set)
!
! Hash tables persist for the life of the process, as in WSJT-X.
!
! c77 is set to blanks before each pack77 call. Some invalid messages make pack77 set
! i3/n3 and return without writing c77 (e.g. pack77_3 when the report doesn't read as
! a number); WSJT-X then uses whatever was in that memory. Blanks make that case
! deterministic: unpack77 rejects them, as it would most leftover memory.

program oracle
  use packjt77
  character*512 line
  character*37 msg,msgsent
  character*77 c77
  character*13 c13
  character*6 c6
  logical ok
  integer i3,n3,nrx,n10,n12,n22,iz

  do
     line=' '
     read(*,'(a)',end=999) line
     select case (line(1:1))
     case ('G')
        msg=line(3:39)
        call fmtmsg(msg,iz)
        i3=-1
        n3=-1
        c77=' '
        call pack77(msg,i3,n3,c77)
        call unpack77(c77,0,msgsent,ok)
        if(.not.ok) then
           c77=repeat('0',77)
           msgsent='*** bad message ***'
        endif
        write(*,'(a)') 'G|'//c77//'|'//trim(itoa(i3))//'|'//trim(itoa(n3))//'|'// &
             trim(ltoa(ok))//'|'//trim(msgsent)
     case ('P','T')
        msg=line(3:39)
        i3=-1
        n3=-1
        if(line(1:1).eq.'T') then
           i3=0
           n3=5
        endif
        c77=' '
        call pack77(msg,i3,n3,c77)
        write(*,'(a)') line(1:1)//'|'//c77//'|'//trim(itoa(i3))//'|'//trim(itoa(n3))
     case ('U')
        read(line(3:3),'(i1)') nrx
        c77=line(5:81)
        call unpack77(c77,nrx,msgsent,ok)
        write(*,'(a)') 'U|'//trim(ltoa(ok))//'|'//trim(msgsent)
     case ('M')
        mycall13=line(3:15)
        write(*,'(a)') 'M'
     case ('D')
        dxcall13=line(3:15)
        write(*,'(a)') 'D'
     case ('X')
        c6=line(3:8)
        dxbase=c6
        write(*,'(a)') 'X'
     case ('H')
        c13=line(3:15)
        n10=-1          ! save_hash_call leaves these unset when it ignores the call
        n12=-1
        n22=-1
        call save_hash_call(c13,n10,n12,n22)
        write(*,'(a)') 'H|'//trim(itoa(n10))//'|'//trim(itoa(n12))//'|'//trim(itoa(n22))
     case default
        write(*,'(a)') '?'
     end select
     flush(6)
  enddo

999 continue

contains

  function itoa(i) result(s)
    integer i
    character*12 s
    write(s,'(i0)') i
  end function itoa

  function ltoa(l) result(s)
    logical l
    character*1 s
    s='0'
    if(l) s='1'
  end function ltoa

end program oracle
