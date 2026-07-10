class Adotui < Formula
  desc "Terminal UI for managing Azure DevOps pull requests"
  homepage "https://github.com/techniumlabs/adotui"
  version "0.1.0"

  on_macos do
    if Hardware::CPU.intel?
      url "https://github.com/techniumlabs/adotui/releases/download/v0.1.0/adotui-macos-x64"
      sha256 "ce80b60b64b981e01db7d055c8ac222143bd93c46eef5384aef8e0c427680676"
    elsif Hardware::CPU.arm?
      url "https://github.com/techniumlabs/adotui/releases/download/v0.1.0/adotui-macos-arm64"
      sha256 "19e110f1bc44cffd4d0b1dbf1058adbdef814867f262137dc74da866375f4e5c"
    end
  end

  on_linux do
    if Hardware::CPU.intel?
      url "https://github.com/techniumlabs/adotui/releases/download/v0.1.0/adotui-linux-x64"
      sha256 "1b9c7df6223a2cc4d1c0366c654ce53e669ddfcb52d521da928671196e733653"
    elsif Hardware::CPU.arm?
      url "https://github.com/techniumlabs/adotui/releases/download/v0.1.0/adotui-linux-arm64"
      sha256 "7907eb6f81be0e6c1673ce3df6a5b5907e99c172fe8a084e08aaa54619da7dce"
    end
  end

  def install
    if OS.mac? && Hardware::CPU.intel?
      bin.install "adotui-macos-x64" => "adotui"
    elsif OS.mac? && Hardware::CPU.arm?
      bin.install "adotui-macos-arm64" => "adotui"
    elsif OS.linux? && Hardware::CPU.intel?
      bin.install "adotui-linux-x64" => "adotui"
    elsif OS.linux? && Hardware::CPU.arm?
      bin.install "adotui-linux-arm64" => "adotui"
    end
  end
end
