class Adotui < Formula
  desc "Terminal UI for managing Azure DevOps pull requests"
  homepage "https://github.com/techniumlabs/adotui"
  version "0.3.0"

  on_macos do
    if Hardware::CPU.intel?
      url "https://github.com/techniumlabs/adotui/releases/download/v0.3.0/adotui-macos-x64"
      sha256 "cded102fcdaa5d9392a85e15ae9b8aa73c0309de861219b548e089236b4d7d76"
    elsif Hardware::CPU.arm?
      url "https://github.com/techniumlabs/adotui/releases/download/v0.3.0/adotui-macos-arm64"
      sha256 "ac517e98789732924a597762f6e3399568279130f10c8e2e39ebf63f98f3d2c9"
    end
  end

  on_linux do
    if Hardware::CPU.intel?
      url "https://github.com/techniumlabs/adotui/releases/download/v0.3.0/adotui-linux-x64"
      sha256 "08b1bc0784eb51f71b84b90d5a0cdd36c3517d615c29d667ee3dfc8f9ea49d85"
    elsif Hardware::CPU.arm?
      url "https://github.com/techniumlabs/adotui/releases/download/v0.3.0/adotui-linux-arm64"
      sha256 "8cb92dbd1bc7fd40850645884358b71fab4b09dd9fde04b576a35ea42de1a1a9"
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
